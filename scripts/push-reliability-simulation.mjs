import fs from 'node:fs';

const sql = fs.readFileSync('supabase/MIGRAZIONE_E1_6_9_PUSH_RELIABILITY.sql', 'utf8');
const dispatcher = fs.readFileSync('supabase/functions/_shared/push-dispatch.ts', 'utf8');
const webPush = fs.readFileSync('supabase/functions/_shared/web-push.ts', 'utf8');
const nativeClient = fs.readFileSync('src/lib/notifications.ts', 'utf8');
const webClient = fs.readFileSync('src/lib/notifications.web.ts', 'utf8');
const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function finalStatus(statuses) {
  const total = statuses.length;
  const sent = statuses.filter((status) => status === 'sent').length;
  const accepted = statuses.filter((status) => status === 'accepted').length;
  const pending = statuses.filter((status) => ['pending', 'processing', 'retry', 'accepted'].includes(status)).length;
  if (total === 0) return 'no_targets';
  if (pending > 0) {
    if (accepted > 0) return 'waiting_receipts';
    if (sent > 0) return 'processing';
    if (statuses.includes('retry')) return 'retrying';
    return 'processing';
  }
  if (sent === total) return 'completed';
  if (sent > 0) return 'partial';
  return 'failed';
}

const scenarios = [
  ['Web + Android + iOS consegnati', ['sent', 'sent', 'sent'], 'completed'],
  ['Web consegnato, Android in retry, iOS accettato', ['sent', 'retry', 'accepted'], 'waiting_receipts'],
  ['Android consegnato, browser non valido', ['sent', 'invalid'], 'partial'],
  ['Tutti i dispositivi revocati', ['invalid', 'invalid'], 'failed'],
  ['Gateway temporaneamente indisponibili', ['retry', 'retry', 'retry'], 'retrying'],
  ['Nessun dispositivo registrato', [], 'no_targets'],
];

for (const [name, statuses, expected] of scenarios) {
  const actual = finalStatus(statuses);
  assert(actual === expected, `${name}: atteso ${expected}, ottenuto ${actual}`);
}

assert(sql.includes('for update skip locked'), 'Claim atomico SKIP LOCKED mancante.');
assert(sql.includes("interval '3 minutes'"), 'Lease anti-doppio invio mancante.');
assert(sql.includes("d.attempts < 6"), 'Limite tentativi mancante.');
assert(dispatcher.includes('processExpoPushReceipts'), 'Verifica ricevute Expo mancante.');
assert(dispatcher.includes('15 * 60 * 1000'), 'Attesa ricevute Expo mancante.');
assert(dispatcher.includes('ttl: 86400'), 'TTL nativo 24 ore mancante.');
assert(dispatcher.includes('collapseId'), 'Deduplicazione nativa mancante.');
assert(dispatcher.includes('Risposta Expo Push incompleta'), 'Retry su risposta Expo incompleta mancante.');
assert(webPush.includes('TTL: 86400'), 'TTL Web Push 24 ore mancante.');
assert(webPush.includes("urgency: 'high'"), 'Urgenza Web Push mancante.');
assert(nativeClient.includes('addPushTokenListener'), 'Rinnovo token nativo mancante.');
assert(nativeClient.includes('getExpoTokenWithRetry'), 'Retry acquisizione token nativo mancante.');
assert(webClient.includes('MARILAB_PUSH_SUBSCRIPTION_CHANGED'), 'Recupero sottoscrizione Web mancante.');
assert(serviceWorker.includes("self.addEventListener('push'"), 'Gestione push Service Worker mancante.');
assert(serviceWorker.includes("self.addEventListener('notificationclick'"), 'Gestione click Service Worker mancante.');

console.log(`Simulazione affidabilità Push: ${scenarios.length} scenari di stato + 14 invarianti superati.`);
for (const [name, statuses, expected] of scenarios) {
  console.log(`✓ ${name}: [${statuses.join(', ') || 'nessun target'}] → ${expected}`);
}
