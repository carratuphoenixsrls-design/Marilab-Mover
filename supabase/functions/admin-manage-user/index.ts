import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const random = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
  return `Mover-${random}!`;
}

function validEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) throw new Error('Sessione mancante.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new Error('Sessione non valida.');

    const { data: caller, error: callerError } = await adminClient
      .from('profiles')
      .select('id, role, active')
      .eq('id', authData.user.id)
      .single();
    if (callerError || !caller?.active || caller.role !== 'admin') throw new Error('Funzione riservata agli Admin.');

    const body = await req.json();
    const action = String(body.action ?? '');

    if (action === 'create') {
      const fullName = String(body.fullName ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const phone = String(body.phone ?? '').trim() || null;
      const role = ['requester', 'mover', 'admin'].includes(body.role) ? body.role : 'requester';
      const siteId = body.siteId ? String(body.siteId) : null;
      if (fullName.length < 3) throw new Error('Inserisci nome e cognome.');
      if (!validEmail(email)) throw new Error('Email non valida.');

      const password = temporaryPassword();
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createError || !created.user) throw createError ?? new Error('Creazione utente non riuscita.');

      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .update({ full_name: fullName, email, phone, role, site_id: siteId, active: true, must_change_password: true })
        .eq('id', created.user.id)
        .select('*')
        .single();
      if (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        throw profileError;
      }

      return Response.json({ user: profile, temporaryPassword: password }, { headers: corsHeaders });
    }

    if (action === 'update') {
      const userId = String(body.userId ?? body.id ?? '');
      const fullName = String(body.fullName ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const phone = String(body.phone ?? '').trim() || null;
      const role = ['requester', 'mover', 'admin'].includes(body.role) ? body.role : 'requester';
      const siteId = body.siteId ? String(body.siteId) : null;
      if (!userId) throw new Error('Utente non valido.');
      if (fullName.length < 3) throw new Error('Inserisci nome e cognome.');
      if (!validEmail(email)) throw new Error('Email non valida.');

      const { data: target, error: targetError } = await adminClient.from('profiles').select('role, active').eq('id', userId).single();
      if (targetError || !target) throw new Error('Utente non trovato.');
      if (target.role === 'admin' && role !== 'admin' && target.active) {
        const { count } = await adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
        if ((count ?? 0) <= 1) throw new Error('Deve rimanere almeno un Admin attivo.');
      }

      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (authUpdateError) throw authUpdateError;

      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .update({ full_name: fullName, email, phone, role, site_id: siteId })
        .eq('id', userId)
        .select('*')
        .single();
      if (profileError) throw profileError;
      return Response.json({ user: profile }, { headers: corsHeaders });
    }

    if (action === 'reset_password') {
      const userId = String(body.userId ?? '');
      const password = temporaryPassword();
      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password });
      if (updateError) throw updateError;
      const { error: profileError } = await adminClient.from('profiles').update({ must_change_password: true }).eq('id', userId);
      if (profileError) throw profileError;
      return Response.json({ temporaryPassword: password }, { headers: corsHeaders });
    }

    if (action === 'set_active') {
      const userId = String(body.userId ?? '');
      const active = Boolean(body.active);
      if (userId === authData.user.id && !active) throw new Error('Non puoi disattivare il tuo account.');
      const { data: target, error: targetError } = await adminClient.from('profiles').select('role, active').eq('id', userId).single();
      if (targetError || !target) throw new Error('Utente non trovato.');
      if (!active && target.role === 'admin' && target.active) {
        const { count } = await adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
        if ((count ?? 0) <= 1) throw new Error('Deve rimanere almeno un Admin attivo.');
      }
      const { error: profileError } = await adminClient.from('profiles').update({ active }).eq('id', userId);
      if (profileError) throw profileError;
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: active ? 'none' : '876000h',
      });
      if (authUpdateError) throw authUpdateError;
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    if (action === 'delete') {
      const userId = String(body.userId ?? '');
      if (!userId) throw new Error('Utente non valido.');
      if (userId === authData.user.id) throw new Error('Non puoi eliminare il tuo account Admin.');

      const { data: target, error: targetError } = await adminClient.from('profiles').select('role, active').eq('id', userId).single();
      if (targetError || !target) throw new Error('Utente non trovato.');
      if (target.role === 'admin' && target.active) {
        const { count } = await adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
        if ((count ?? 0) <= 1) throw new Error('Deve rimanere almeno un Admin attivo.');
      }

      const [requested, assigned, team, events, messages, notifications] = await Promise.all([
        adminClient.from('delivery_requests').select('id', { count: 'exact', head: true }).eq('requester_id', userId),
        adminClient.from('delivery_requests').select('id', { count: 'exact', head: true }).eq('assigned_mover_id', userId),
        adminClient.from('delivery_requests').select('id', { count: 'exact', head: true }).contains('assigned_mover_ids', [userId]),
        adminClient.from('request_events').select('id', { count: 'exact', head: true }).eq('actor_id', userId),
        adminClient.from('chat_messages').select('id', { count: 'exact', head: true }).or(`sender_id.eq.${userId},recipient_id.eq.${userId}`),
        adminClient.from('app_notifications').select('id', { count: 'exact', head: true }).eq('created_by', userId),
      ]);
      const hasHistory = [requested, assigned, team, events, messages, notifications].some((result) => (result.count ?? 0) > 0);

      if (hasHistory) {
        const { error: profileError } = await adminClient.from('profiles').update({ active: false }).eq('id', userId);
        if (profileError) throw profileError;
        const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
        if (authUpdateError) throw authUpdateError;
        return Response.json({ ok: true, mode: 'archived' }, { headers: corsHeaders });
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;
      return Response.json({ ok: true, mode: 'deleted' }, { headers: corsHeaders });
    }

    throw new Error('Azione non supportata.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore interno.';
    return Response.json({ error: message }, { status: 400, headers: corsHeaders });
  }
});
