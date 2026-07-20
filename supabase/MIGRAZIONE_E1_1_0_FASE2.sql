-- MARILAB MOVER 1.1.0 - FASE 2 OPERATIVA
-- Autore ufficiale: Fabio Carratù
-- Eseguire una sola volta nel SQL Editor del progetto Supabase già configurato.
-- Flusso definitivo: Presa in carico -> Ritirata -> In viaggio -> Consegnata -> Chiusa.
-- Nessun programma rientro.

begin;

-- Compatibilità con release precedenti.
alter table public.delivery_requests
  add column if not exists assigned_mover_ids uuid[] not null default '{}';

update public.delivery_requests
set assigned_mover_ids = array[assigned_mover_id]::uuid[]
where assigned_mover_id is not null
  and coalesce(cardinality(assigned_mover_ids), 0) = 0;

-- Normalizza gli stati storici non più usati dall'app.
update public.delivery_requests
set status = 'pending'
where status = 'approved';

update public.delivery_requests
set status = 'delivered'
where status = 'return_required';

create index if not exists delivery_requests_movers_gin_idx
  on public.delivery_requests using gin (assigned_mover_ids);

-- Assegnazione Admin coerente anche con le squadre Mover.
create or replace function public.assign_delivery_mover(
  p_request_id uuid,
  p_mover_id uuid
)
returns public.delivery_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated public.delivery_requests;
begin
  if not public.is_admin() then
    raise exception 'Funzione riservata agli Admin';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_mover_id
      and p.role = 'mover'
      and p.active
  ) then
    raise exception 'Mover non valido o non attivo';
  end if;

  update public.delivery_requests
  set assigned_mover_id = p_mover_id,
      assigned_mover_ids = array[p_mover_id]::uuid[],
      status = case when status in ('pending', 'approved') then 'assigned' else status end
  where id = p_request_id
    and status not in ('completed', 'cancelled')
  returning * into updated;

  if updated.id is null then
    raise exception 'Richiesta non trovata o già chiusa';
  end if;

  return updated;
end;
$$;

-- Presa in carico singola o in squadra, in un solo passaggio.
create or replace function public.take_delivery_request(
  p_request_id uuid,
  p_mover_ids uuid[]
)
returns public.delivery_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated public.delivery_requests;
  clean_ids uuid[];
begin
  if public.current_role() not in ('mover', 'admin') then
    raise exception 'Funzione riservata ai Mover e agli Admin';
  end if;

  select array_agg(distinct selected.mover_id)
  into clean_ids
  from unnest(coalesce(p_mover_ids, array[]::uuid[])) as selected(mover_id)
  where selected.mover_id is not null;

  if coalesce(cardinality(clean_ids), 0) = 0 then
    raise exception 'Seleziona almeno un Mover';
  end if;

  if exists (
    select 1
    from unnest(clean_ids) as selected(mover_id)
    left join public.profiles p on p.id = selected.mover_id
    where p.id is null
       or p.role <> 'mover'
       or not p.active
  ) then
    raise exception 'Uno dei Mover selezionati non è valido o non è attivo';
  end if;

  update public.delivery_requests
  set assigned_mover_ids = clean_ids,
      assigned_mover_id = clean_ids[1],
      status = case when status in ('pending', 'approved') then 'assigned' else status end
  where id = p_request_id
    and status not in ('completed', 'cancelled')
  returning * into updated;

  if updated.id is null then
    raise exception 'Richiesta non disponibile';
  end if;

  return updated;
end;
$$;

-- Transizioni rigorose della Fase 2.
create or replace function public.update_delivery_status(
  p_request_id uuid,
  p_status public.request_status
)
returns public.delivery_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_request public.delivery_requests;
  updated public.delivery_requests;
  user_is_assigned boolean;
begin
  select *
  into current_request
  from public.delivery_requests
  where id = p_request_id
  for update;

  if current_request.id is null then
    raise exception 'Richiesta non trovata';
  end if;

  user_is_assigned :=
    current_request.assigned_mover_id = auth.uid()
    or auth.uid() = any(coalesce(current_request.assigned_mover_ids, array[]::uuid[]));

  if not public.is_admin() then
    if public.current_role() <> 'mover' or not user_is_assigned then
      raise exception 'Puoi aggiornare soltanto le consegne che stai gestendo';
    end if;

    if not (
      -- Compatibilità per vecchie missioni già assegnate ma rimaste pending/approved.
      (current_request.status in ('pending', 'approved', 'assigned') and p_status = 'picked_up') or
      (current_request.status = 'picked_up' and p_status = 'in_transit') or
      (current_request.status = 'in_transit' and p_status = 'delivered') or
      (current_request.status in ('delivered', 'return_required') and p_status = 'completed')
    ) then
      raise exception 'Passaggio di stato non consentito: % -> %', current_request.status, p_status;
    end if;
  end if;

  update public.delivery_requests
  set status = p_status,
      assigned_mover_id = coalesce(assigned_mover_id, auth.uid()),
      assigned_mover_ids = case
        when coalesce(cardinality(assigned_mover_ids), 0) = 0 and auth.uid() is not null
          then array[auth.uid()]::uuid[]
        else assigned_mover_ids
      end
  where id = p_request_id
  returning * into updated;

  if p_status in ('delivered', 'completed') then
    update public.equipment
    set current_site_id = updated.destination_site_id
    where id = updated.equipment_id;
  end if;

  return updated;
end;
$$;

-- Statistiche corrette per tutti i membri della squadra Mover.
create or replace function public.admin_delivery_statistics(
  p_from_date date default null,
  p_to_date date default null,
  p_site_id uuid default null,
  p_equipment_id uuid default null,
  p_mover_id uuid default null,
  p_status public.request_status default null,
  p_priority public.request_priority default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Statistiche riservate agli Admin';
  end if;

  with filtered as (
    select r.*
    from public.delivery_requests r
    where (p_from_date is null or r.requested_date >= p_from_date)
      and (p_to_date is null or r.requested_date <= p_to_date)
      and (p_site_id is null or r.pickup_site_id = p_site_id or r.destination_site_id = p_site_id)
      and (p_equipment_id is null or r.equipment_id = p_equipment_id)
      and (
        p_mover_id is null
        or r.assigned_mover_id = p_mover_id
        or p_mover_id = any(coalesce(r.assigned_mover_ids, array[]::uuid[]))
      )
      and (p_status is null or r.status = p_status)
      and (p_priority is null or r.priority = p_priority)
  ), completed_events as (
    select e.request_id, min(e.created_at) as completed_at
    from public.request_events e
    where e.new_status = 'completed'
    group by e.request_id
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'completed', (select count(*) from filtered where status = 'completed'),
    'active', (select count(*) from filtered where status not in ('completed', 'cancelled')),
    'urgent', (select count(*) from filtered where priority = 'urgent'),
    'late', (
      select count(*)
      from filtered
      where status not in ('delivered', 'return_required', 'completed', 'cancelled')
        and (requested_date + requested_time) < timezone('Europe/Rome', now())
    ),
    'average_cycle_minutes', (
      select round(avg(extract(epoch from (ce.completed_at - f.created_at)) / 60.0)::numeric, 1)
      from filtered f
      join completed_events ce on ce.request_id = f.id
    ),
    'by_site', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', x.id, 'label', x.label, 'count', x.count)
        order by x.count desc, x.label
      )
      from (
        select s.id::text as id, s.short_name as label, count(*)::int as count
        from filtered f
        join public.sites s on s.id = f.destination_site_id
        group by s.id, s.short_name
      ) x
    ), '[]'::jsonb),
    'by_equipment', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', x.id, 'label', x.label, 'count', x.count)
        order by x.count desc, x.label
      )
      from (
        select e.id::text as id, e.name as label, count(*)::int as count
        from filtered f
        join public.equipment e on e.id = f.equipment_id
        group by e.id, e.name
      ) x
    ), '[]'::jsonb),
    'by_mover', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', x.id, 'label', x.label, 'count', x.count)
        order by x.count desc, x.label
      )
      from (
        select
          coalesce(p.id::text, 'unassigned') as id,
          coalesce(p.full_name, 'Non assegnato') as label,
          count(*)::int as count
        from filtered f
        left join lateral unnest(
          case
            when coalesce(cardinality(f.assigned_mover_ids), 0) > 0
              then f.assigned_mover_ids
            when f.assigned_mover_id is not null
              then array[f.assigned_mover_id]::uuid[]
            else array[null::uuid]
          end
        ) as team(mover_id) on true
        left join public.profiles p on p.id = team.mover_id
        group by p.id, p.full_name
      ) x
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Promemoria solo per la consegna: nessun promemoria di rientro.
create or replace function public.claim_due_reminders()
returns table (notification_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with clock as (
    select timezone('Europe/Rome', now()) as local_now
  ), candidates as (
    select
      r.id as request_id,
      'delivery_24h'::text as reminder_key,
      ('Consegna prevista domani · ' || r.code)::text as title,
      (
        e.name || ' da ' || pickup.short_name || ' a ' || destination.short_name || ' · ' ||
        to_char(r.requested_date, 'DD/MM/YYYY') || ' ore ' || to_char(r.requested_time, 'HH24:MI')
      )::text as body
    from public.delivery_requests r
    join public.equipment e on e.id = r.equipment_id
    join public.sites pickup on pickup.id = r.pickup_site_id
    join public.sites destination on destination.id = r.destination_site_id
    cross join clock c
    where r.status not in ('delivered', 'return_required', 'completed', 'cancelled')
      and (r.requested_date + r.requested_time)
        between c.local_now + interval '22 hours' and c.local_now + interval '26 hours'

    union all

    select
      r.id,
      'delivery_2h',
      ('Consegna imminente · ' || r.code),
      (e.name || ' da ' || pickup.short_name || ' a ' || destination.short_name || ' entro le ' || to_char(r.requested_time, 'HH24:MI'))
    from public.delivery_requests r
    join public.equipment e on e.id = r.equipment_id
    join public.sites pickup on pickup.id = r.pickup_site_id
    join public.sites destination on destination.id = r.destination_site_id
    cross join clock c
    where r.status not in ('delivered', 'return_required', 'completed', 'cancelled')
      and (r.requested_date + r.requested_time)
        between c.local_now and c.local_now + interval '2 hours'

    union all

    select
      r.id,
      'overdue',
      ('Consegna in ritardo · ' || r.code),
      (e.name || ' per ' || destination.short_name || ' risulta ancora ' || replace(r.status::text, '_', ' '))
    from public.delivery_requests r
    join public.equipment e on e.id = r.equipment_id
    join public.sites destination on destination.id = r.destination_site_id
    cross join clock c
    where r.status not in ('delivered', 'return_required', 'completed', 'cancelled')
      and (r.requested_date + r.requested_time) < c.local_now
  ), claimed as (
    insert into public.reminder_dispatches (request_id, reminder_key)
    select distinct c.request_id, c.reminder_key
    from candidates c
    on conflict (request_id, reminder_key) do nothing
    returning request_id, reminder_key
  ), inserted as (
    insert into public.app_notifications (kind, title, body, request_id, created_by)
    select 'reminder', c.title, c.body, c.request_id, null
    from candidates c
    join claimed d
      on d.request_id = c.request_id
     and d.reminder_key = c.reminder_key
    returning id
  )
  select inserted.id
  from inserted;
end;
$$;

grant execute on function public.assign_delivery_mover(uuid, uuid) to authenticated;
grant execute on function public.take_delivery_request(uuid, uuid[]) to authenticated;
grant execute on function public.update_delivery_status(uuid, public.request_status) to authenticated;
grant execute on function public.admin_delivery_statistics(date, date, uuid, uuid, uuid, public.request_status, public.request_priority) to authenticated;

commit;

notify pgrst, 'reload schema';
