import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sendWebPushBatch } from './web-push.ts';

export type PushNotificationRow = {
  id: number;
  title: string;
  body: string;
  request_id: string | null;
  kind: string;
  recipient_user_id: string | null;
};

export type PushTargetFilter = {
  provider?: 'expo' | 'web';
  key?: string;
};

type ClaimedDelivery = {
  delivery_id: number;
  notification_id: number;
  provider: 'expo' | 'web';
  target_id: number;
  user_id: string;
  attempts: number;
  title: string;
  body: string;
  request_id: string | null;
  kind: string;
  expo_push_token: string | null;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
};

type ExpoReceiptRow = {
  id: number;
  notification_id: number;
  target_id: number;
  ticket_id: string;
  attempts: number;
  accepted_at: string | null;
};

const MAX_ATTEMPTS = 6;
const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function retryAt(attempts: number) {
  const seconds = Math.min(3600, 15 * (2 ** Math.max(0, attempts - 1)));
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function safeError(error: unknown) {
  if (error instanceof Error && error.message) return error.message.slice(0, 1000);
  return String(error ?? 'Errore push sconosciuto').slice(0, 1000);
}

async function markDelivery(
  admin: SupabaseClient,
  deliveryId: number,
  values: Record<string, unknown>,
) {
  const { error } = await admin.from('push_deliveries').update({
    ...values,
    lease_until: null,
  }).eq('id', deliveryId);
  if (error) throw error;
}

async function markRetry(
  admin: SupabaseClient,
  delivery: Pick<ClaimedDelivery, 'delivery_id' | 'attempts'>,
  message: string,
  statusCode = 0,
) {
  if (delivery.attempts >= MAX_ATTEMPTS) {
    await markDelivery(admin, delivery.delivery_id, {
      status: 'failed',
      last_error: message,
      last_status_code: statusCode || null,
    });
    return 'failed' as const;
  }
  await markDelivery(admin, delivery.delivery_id, {
    status: 'retry',
    next_attempt_at: retryAt(delivery.attempts),
    last_error: message,
    last_status_code: statusCode || null,
  });
  return 'retry' as const;
}

async function deactivateTarget(admin: SupabaseClient, provider: 'expo' | 'web', targetId: number) {
  const table = provider === 'expo' ? 'push_tokens' : 'web_push_subscriptions';
  await admin.from(table).update({ active: false }).eq('id', targetId);
}

async function finalize(admin: SupabaseClient, notificationId: number) {
  const { data, error } = await admin.rpc('finalize_push_notification', { p_notification_id: notificationId });
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}

export async function enqueuePushDeliveries(
  admin: SupabaseClient,
  notificationId: number,
  targetUserIds: string[],
  filter: PushTargetFilter = {},
) {
  const uniqueUserIds = [...new Set(targetUserIds.filter(Boolean))];
  if (!uniqueUserIds.length) {
    return { enqueued: 0, summary: await finalize(admin, notificationId) };
  }

  const queryNative = filter.provider !== 'web';
  const queryWeb = filter.provider !== 'expo';
  const [nativeResult, webResult] = await Promise.all([
    queryNative
      ? (() => {
          let query = admin.from('push_tokens').select('id, user_id, expo_push_token').eq('active', true).in('user_id', uniqueUserIds);
          if (filter.provider === 'expo' && filter.key) query = query.eq('expo_push_token', filter.key);
          return query;
        })()
      : Promise.resolve({ data: [], error: null }),
    queryWeb
      ? (() => {
          let query = admin.from('web_push_subscriptions').select('id, user_id, endpoint').eq('active', true).in('user_id', uniqueUserIds);
          if (filter.provider === 'web' && filter.key) query = query.eq('endpoint', filter.key);
          return query;
        })()
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (nativeResult.error) throw nativeResult.error;
  if (webResult.error) throw webResult.error;

  const rows = [
    ...(nativeResult.data ?? []).map((row) => ({
      notification_id: notificationId,
      provider: 'expo',
      target_id: row.id,
      user_id: row.user_id,
      status: 'pending',
      next_attempt_at: new Date().toISOString(),
    })),
    ...(webResult.data ?? []).map((row) => ({
      notification_id: notificationId,
      provider: 'web',
      target_id: row.id,
      user_id: row.user_id,
      status: 'pending',
      next_attempt_at: new Date().toISOString(),
    })),
  ];

  if (!rows.length) {
    return { enqueued: 0, summary: await finalize(admin, notificationId) };
  }

  const { error } = await admin.from('push_deliveries').upsert(rows, {
    onConflict: 'notification_id,provider,target_id',
    ignoreDuplicates: true,
  });
  if (error) throw error;

  await admin.from('app_notifications').update({
    push_status: 'queued',
    push_completed_at: null,
    push_last_attempt_at: new Date().toISOString(),
  }).eq('id', notificationId).in('push_status', ['pending', 'queued', 'retrying', 'no_targets']);

  return { enqueued: rows.length };
}

function expoErrorAction(errorCode: string) {
  if (errorCode === 'DeviceNotRegistered') return 'invalid' as const;
  if (errorCode === 'MessageRateExceeded') return 'retry' as const;
  return 'failed' as const;
}

export async function dispatchPushNotification(admin: SupabaseClient, notificationId: number) {
  const { data: claimedData, error: claimError } = await admin.rpc('claim_push_deliveries', {
    p_notification_id: notificationId,
    p_limit: 1000,
  });
  if (claimError) throw claimError;
  const claimed = (claimedData ?? []) as ClaimedDelivery[];

  const expoDeliveries = claimed.filter((delivery) => delivery.provider === 'expo');
  const webDeliveries = claimed.filter((delivery) => delivery.provider === 'web');

  let sentWeb = 0;
  let acceptedExpo = 0;
  let retried = 0;
  let failed = 0;
  let invalid = 0;

  for (const batch of chunks(expoDeliveries, 100)) {
    const validBatch = batch.filter((delivery) => Boolean(delivery.expo_push_token));
    for (const delivery of batch.filter((item) => !item.expo_push_token)) {
      await markDelivery(admin, delivery.delivery_id, {
        status: 'invalid',
        last_error: 'Token Expo non più attivo o non disponibile.',
      });
      invalid += 1;
    }
    if (!validBatch.length) continue;

    try {
      const response = await fetch(EXPO_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(validBatch.map((delivery) => ({
          to: delivery.expo_push_token,
          sound: 'default',
          badge: 1,
          ttl: 86400,
          priority: 'high',
          title: delivery.title,
          body: delivery.body,
          data: {
            notificationId: delivery.notification_id,
            requestId: delivery.request_id,
            kind: delivery.kind,
            url: '/',
          },
          channelId: 'deliveries',
          collapseId: `marilab-mover-${delivery.notification_id}`,
          tag: `marilab-mover-${delivery.notification_id}`,
        }))),
      });

      if (!response.ok) {
        const message = `Expo Push ha risposto ${response.status}.`;
        const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        for (const delivery of validBatch) {
          if (retryable) {
            const result = await markRetry(admin, delivery, message, response.status);
            if (result === 'retry') retried += 1; else failed += 1;
          } else {
            await markDelivery(admin, delivery.delivery_id, { status: 'failed', last_error: message, last_status_code: response.status });
            failed += 1;
          }
        }
        continue;
      }

      const payload = await response.json();
      if (!Array.isArray(payload?.data) || payload.data.length !== validBatch.length) {
        const message = 'Risposta Expo Push incompleta o non riconoscibile.';
        for (const delivery of validBatch) {
          const result = await markRetry(admin, delivery, message, 502);
          if (result === 'retry') retried += 1; else failed += 1;
        }
        continue;
      }
      const tickets = payload.data as Array<Record<string, unknown>>;
      for (let index = 0; index < validBatch.length; index += 1) {
        const delivery = validBatch[index];
        const ticket = tickets[index] as Record<string, unknown> | undefined;
        if (ticket?.status === 'ok' && typeof ticket.id === 'string' && ticket.id) {
          await markDelivery(admin, delivery.delivery_id, {
            status: 'accepted',
            ticket_id: ticket.id,
            accepted_at: new Date().toISOString(),
            last_error: null,
            last_status_code: 200,
          });
          acceptedExpo += 1;
          continue;
        }

        const details = ticket?.details as Record<string, unknown> | undefined;
        const errorCode = String(details?.error ?? 'ExpoTicketError');
        const message = String(ticket?.message ?? errorCode).slice(0, 1000);
        const action = expoErrorAction(errorCode);
        if (action === 'invalid') {
          await markDelivery(admin, delivery.delivery_id, { status: 'invalid', last_error: message, last_status_code: 400 });
          await deactivateTarget(admin, 'expo', delivery.target_id);
          invalid += 1;
        } else if (action === 'retry') {
          const result = await markRetry(admin, delivery, message, 429);
          if (result === 'retry') retried += 1; else failed += 1;
        } else {
          await markDelivery(admin, delivery.delivery_id, { status: 'failed', last_error: message, last_status_code: 400 });
          failed += 1;
        }
      }
    } catch (error) {
      const message = safeError(error);
      for (const delivery of validBatch) {
        const result = await markRetry(admin, delivery, message);
        if (result === 'retry') retried += 1; else failed += 1;
      }
    }
  }

  if (webDeliveries.length) {
    const validWeb = webDeliveries.filter((delivery) => delivery.endpoint && delivery.p256dh && delivery.auth);
    for (const delivery of webDeliveries.filter((item) => !item.endpoint || !item.p256dh || !item.auth)) {
      await markDelivery(admin, delivery.delivery_id, {
        status: 'invalid',
        last_error: 'Sottoscrizione Web Push non più attiva o incompleta.',
      });
      invalid += 1;
    }

    if (validWeb.length) {
      const byDeliveryId = new Map(validWeb.map((delivery) => [delivery.delivery_id, delivery]));
      const result = await sendWebPushBatch(validWeb.map((delivery) => ({
        id: delivery.delivery_id,
        endpoint: delivery.endpoint!,
        p256dh: delivery.p256dh!,
        auth: delivery.auth!,
      })), {
        title: validWeb[0].title,
        body: validWeb[0].body,
        notificationId,
        requestId: validWeb[0].request_id,
        kind: validWeb[0].kind,
        url: '/',
        tag: `marilab-mover-${notificationId}`,
      });

      for (const outcome of result.outcomes) {
        const delivery = byDeliveryId.get(outcome.id);
        if (!delivery) continue;
        if (outcome.result === 'sent') {
          await markDelivery(admin, delivery.delivery_id, {
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: null,
            last_status_code: outcome.statusCode,
          });
          sentWeb += 1;
        } else if (outcome.result === 'invalid' || outcome.result === 'refresh') {
          await markDelivery(admin, delivery.delivery_id, {
            status: 'invalid',
            last_error: outcome.message ?? 'Sottoscrizione Web Push non valida.',
            last_status_code: outcome.statusCode || null,
          });
          await deactivateTarget(admin, 'web', delivery.target_id);
          invalid += 1;
        } else if (outcome.result === 'retry') {
          const retryResult = await markRetry(admin, delivery, outcome.message ?? 'Gateway Web Push temporaneamente non disponibile.', outcome.statusCode);
          if (retryResult === 'retry') retried += 1; else failed += 1;
        } else {
          await markDelivery(admin, delivery.delivery_id, {
            status: 'failed',
            last_error: outcome.message ?? 'Invio Web Push non riuscito.',
            last_status_code: outcome.statusCode || null,
          });
          failed += 1;
        }
      }
    }
  }

  const summary = await finalize(admin, notificationId);
  return {
    claimed: claimed.length,
    sentWeb,
    acceptedExpo,
    retried,
    failed,
    invalid,
    summary,
  };
}

export async function processExpoPushReceipts(admin: SupabaseClient, limit = 1000) {
  const readyBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('push_deliveries')
    .select('id, notification_id, target_id, ticket_id, attempts, accepted_at')
    .eq('provider', 'expo')
    .eq('status', 'accepted')
    .not('ticket_id', 'is', null)
    .lte('accepted_at', readyBefore)
    .order('accepted_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 1000)));
  if (error) throw error;
  const rows = (data ?? []) as ExpoReceiptRow[];
  if (!rows.length) return { checked: 0, sent: 0, invalid: 0, failed: 0, retried: 0 };

  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ids: rows.map((row) => row.ticket_id) }),
  });
  if (!response.ok) {
    return { checked: rows.length, sent: 0, invalid: 0, failed: 0, retried: 0, deferred: true, status: response.status };
  }

  const payload = await response.json();
  const receipts = (payload?.data ?? {}) as Record<string, Record<string, unknown>>;
  const notificationIds = new Set<number>();
  let sent = 0;
  let invalid = 0;
  let failed = 0;
  let retried = 0;

  for (const row of rows) {
    const receipt = receipts[row.ticket_id];
    if (!receipt) {
      const age = row.accepted_at ? Date.now() - new Date(row.accepted_at).getTime() : 0;
      if (age >= 23 * 60 * 60 * 1000) {
        const result = await markRetry(admin, {
          delivery_id: row.id,
          attempts: row.attempts,
        }, 'Ricevuta Expo non disponibile entro 23 ore.');
        if (result === 'retry') retried += 1; else failed += 1;
        notificationIds.add(row.notification_id);
      }
      continue;
    }

    notificationIds.add(row.notification_id);
    if (receipt.status === 'ok') {
      await markDelivery(admin, row.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        last_error: null,
        last_status_code: 200,
      });
      sent += 1;
      continue;
    }

    const details = receipt.details as Record<string, unknown> | undefined;
    const errorCode = String(details?.error ?? 'ExpoReceiptError');
    const message = String(receipt.message ?? errorCode).slice(0, 1000);
    const action = expoErrorAction(errorCode);
    if (action === 'invalid') {
      await markDelivery(admin, row.id, { status: 'invalid', last_error: message, last_status_code: 400 });
      await deactivateTarget(admin, 'expo', row.target_id);
      invalid += 1;
    } else if (action === 'retry') {
      const result = await markRetry(admin, { delivery_id: row.id, attempts: row.attempts }, message, 429);
      if (result === 'retry') retried += 1; else failed += 1;
    } else {
      await markDelivery(admin, row.id, { status: 'failed', last_error: message, last_status_code: 400 });
      failed += 1;
    }
  }

  for (const notificationId of notificationIds) await finalize(admin, notificationId);
  return { checked: rows.length, sent, invalid, failed, retried };
}

export async function dispatchPendingNotifications(admin: SupabaseClient, limit = 100) {
  const recentCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('app_notifications')
    .select('id, title, body, request_id, kind, recipient_user_id, push_status')
    .is('push_completed_at', null)
    .gte('created_at', recentCutoff)
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 200)));
  if (error) throw error;

  const notifications = (data ?? []) as Array<PushNotificationRow & { push_status: string }>;
  const { data: activeProfiles, error: profilesError } = await admin.from('profiles').select('id').eq('active', true);
  if (profilesError) throw profilesError;
  const activeIds = new Set((activeProfiles ?? []).map((profile) => String(profile.id)));

  let claimed = 0;
  let sentWeb = 0;
  let acceptedExpo = 0;
  for (const notification of notifications) {
    const targets = notification.recipient_user_id
      ? (activeIds.has(notification.recipient_user_id) ? [notification.recipient_user_id] : [])
      : [...activeIds];
    await enqueuePushDeliveries(admin, notification.id, targets);
    const result = await dispatchPushNotification(admin, notification.id);
    claimed += result.claimed;
    sentWeb += result.sentWeb;
    acceptedExpo += result.acceptedExpo;
  }

  return { notifications: notifications.length, claimed, sentWeb, acceptedExpo };
}
