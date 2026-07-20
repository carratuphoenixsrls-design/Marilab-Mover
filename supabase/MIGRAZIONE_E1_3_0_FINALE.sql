-- MARILAB MOVER 1.3.0 FINALE WEB + ANDROID
-- Autore ufficiale: Fabio Carratù
-- Eseguire una sola volta nel SQL Editor di Supabase dopo le migrazioni precedenti.
-- Aggiunge: chat private, cancellazione messaggi, eliminazione consegne chiuse,
-- notifiche mirate, diagnostica push e sicurezza RLS aggiornata.

begin;

alter table public.app_notifications
  add column if not exists recipient_user_id uuid references public.profiles(id) on delete cascade;

alter table public.chat_messages
  add column if not exists recipient_id uuid references public.profiles(id) on delete cascade,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists app_notifications_recipient_idx
  on public.app_notifications(recipient_user_id, created_at desc);
create index if not exists chat_messages_recipient_idx
  on public.chat_messages(recipient_id, created_at desc);
create index if not exists chat_messages_direct_pair_idx
  on public.chat_messages(sender_id, recipient_id, created_at desc);

-- Le notifiche globali sono visibili a tutti gli utenti attivi.
-- Le notifiche private sono visibili solo al destinatario e al creatore.
drop policy if exists notifications_read_active on public.app_notifications;
create policy notifications_read_active on public.app_notifications
for select to authenticated
using (
  public.is_active_user()
  and (
    recipient_user_id is null
    or recipient_user_id = auth.uid()
    or created_by = auth.uid()
  )
);

-- Chat generale e chat consegna: visibili a tutti gli utenti attivi.
-- Chat privata: visibile soltanto ai due partecipanti.
drop policy if exists chat_read_active on public.chat_messages;
create policy chat_read_active on public.chat_messages
for select to authenticated
using (
  public.is_active_user()
  and (
    recipient_id is null
    or sender_id = auth.uid()
    or recipient_id = auth.uid()
  )
);

drop policy if exists chat_insert_active on public.chat_messages;
create policy chat_insert_active on public.chat_messages
for insert to authenticated
with check (
  public.is_active_user()
  and sender_id = auth.uid()
  and (recipient_id is null or recipient_id <> auth.uid())
  and not (request_id is not null and recipient_id is not null)
  and (
    recipient_id is null
    or exists (
      select 1 from public.profiles p
      where p.id = recipient_id and p.active = true
    )
  )
);

create or replace function public.create_app_notification(
  p_kind text,
  p_title text,
  p_body text,
  p_request_id uuid default null,
  p_recipient_user_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare notification_id bigint;
begin
  if not public.is_active_user() then raise exception 'Account non autorizzato'; end if;
  if p_kind not in ('request', 'status', 'assignment', 'reminder', 'chat', 'system') then raise exception 'Tipo notifica non valido'; end if;
  if p_recipient_user_id is not null and not exists (
    select 1 from public.profiles p where p.id = p_recipient_user_id and p.active = true
  ) then
    raise exception 'Destinatario non disponibile';
  end if;

  insert into public.app_notifications(kind, title, body, request_id, created_by, recipient_user_id)
  values (p_kind, p_title, p_body, p_request_id, auth.uid(), p_recipient_user_id)
  returning id into notification_id;
  return notification_id;
end;
$$;

create or replace function public.delete_chat_message(p_message_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare target public.chat_messages%rowtype;
begin
  if not public.is_active_user() then raise exception 'Account non autorizzato'; end if;
  select * into target from public.chat_messages where id = p_message_id;
  if target.id is null then raise exception 'Messaggio non trovato'; end if;
  if target.sender_id <> auth.uid() and not public.is_admin() then
    raise exception 'Puoi eliminare soltanto i tuoi messaggi';
  end if;
  if target.deleted_at is not null then return true; end if;

  update public.chat_messages
  set message = 'Messaggio eliminato', deleted_at = now(), deleted_by = auth.uid()
  where id = p_message_id;
  return true;
end;
$$;

create or replace function public.admin_clear_chat_conversation(
  p_request_id uuid default null,
  p_other_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  if not public.is_admin() then raise exception 'Funzione riservata agli Admin'; end if;
  if p_request_id is not null and p_other_user_id is not null then
    raise exception 'Conversazione non valida';
  end if;

  if p_other_user_id is not null then
    update public.chat_messages
    set message = 'Messaggio eliminato', deleted_at = now(), deleted_by = auth.uid()
    where deleted_at is null
      and request_id is null
      and (
        (sender_id = auth.uid() and recipient_id = p_other_user_id)
        or (sender_id = p_other_user_id and recipient_id = auth.uid())
      );
  elsif p_request_id is not null then
    update public.chat_messages
    set message = 'Messaggio eliminato', deleted_at = now(), deleted_by = auth.uid()
    where deleted_at is null and request_id = p_request_id and recipient_id is null;
  else
    update public.chat_messages
    set message = 'Messaggio eliminato', deleted_at = now(), deleted_by = auth.uid()
    where deleted_at is null and request_id is null and recipient_id is null;
  end if;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.admin_delete_delivery_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare target public.delivery_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'Funzione riservata agli Admin'; end if;
  select * into target from public.delivery_requests where id = p_request_id;
  if target.id is null then raise exception 'Consegna non trovata'; end if;
  if target.status not in ('completed', 'cancelled') then
    raise exception 'Puoi eliminare soltanto consegne chiuse o annullate';
  end if;

  -- Gli elementi collegati sono definiti con ON DELETE CASCADE.
  delete from public.delivery_requests where id = p_request_id;
  return true;
end;
$$;

create or replace function public.admin_push_diagnostics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Funzione riservata agli Admin'; end if;

  select jsonb_build_object(
    'active_users', (select count(*) from public.profiles p where p.active = true),
    'active_tokens', (select count(*) from public.push_tokens t where t.active = true),
    'users_without_token', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email) order by p.full_name)
      from public.profiles p
      where p.active = true
        and not exists (
          select 1 from public.push_tokens t
          where t.user_id = p.id and t.active = true
        )
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.create_app_notification(text, text, text, uuid, uuid) from public, anon;
revoke all on function public.delete_chat_message(bigint) from public, anon;
revoke all on function public.admin_clear_chat_conversation(uuid, uuid) from public, anon;
revoke all on function public.admin_delete_delivery_request(uuid) from public, anon;
revoke all on function public.admin_push_diagnostics() from public, anon;

grant execute on function public.create_app_notification(text, text, text, uuid, uuid) to authenticated;
grant execute on function public.delete_chat_message(bigint) to authenticated;
grant execute on function public.admin_clear_chat_conversation(uuid, uuid) to authenticated;
grant execute on function public.admin_delete_delivery_request(uuid) to authenticated;
grant execute on function public.admin_push_diagnostics() to authenticated;

commit;
