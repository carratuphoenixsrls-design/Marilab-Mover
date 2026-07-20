import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  dispatchPendingNotifications,
  processExpoPushReceipts,
} from '../_shared/push-dispatch.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-cron-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const expectedSecret = Deno.env.get('CRON_SECRET');
    const suppliedSecret = req.headers.get('x-cron-secret');
    if (!expectedSecret || suppliedSecret !== expectedSecret) {
      return Response.json({ error: 'Accesso non autorizzato.' }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Prima consolida le ricevute Expo già mature. In questo modo i token revocati
    // vengono disattivati e le consegne parziali non restano nascoste.
    const receipts = await processExpoPushReceipts(admin);

    // Crea una sola volta gli eventuali promemoria dovuti.
    const { data: claimed, error: claimError } = await admin.rpc('claim_due_reminders');
    if (claimError) throw claimError;

    // Accoda e invia tutte le notifiche recenti non ancora concluse, comprese quelle
    // che in un tentativo precedente hanno raggiunto solo alcuni dispositivi.
    const dispatch = await dispatchPendingNotifications(admin, 100);

    return Response.json({
      remindersCreated: (claimed ?? []).length,
      receipts,
      dispatch,
    }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore interno.';
    return Response.json({ error: message }, { status: 400, headers: corsHeaders });
  }
});
