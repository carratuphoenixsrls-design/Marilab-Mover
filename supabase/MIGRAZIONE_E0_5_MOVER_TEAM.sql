-- Marilab Mover E0.5 - presa in carico autonoma singola o in squadra
alter table public.delivery_requests
  add column if not exists assigned_mover_ids uuid[] not null default '{}';

update public.delivery_requests
set assigned_mover_ids = array[assigned_mover_id]
where assigned_mover_id is not null and cardinality(assigned_mover_ids) = 0;

alter table public.delivery_requests drop constraint if exists note_required_e05;
alter table public.delivery_requests
  add constraint note_required_e05 check (length(btrim(coalesce(note, ''))) >= 3) not valid;

create index if not exists delivery_requests_movers_gin_idx
  on public.delivery_requests using gin (assigned_mover_ids);

create or replace function public.take_delivery_request(p_request_id uuid, p_mover_ids uuid[])
returns public.delivery_requests
language plpgsql security definer set search_path = '' as $$
declare updated public.delivery_requests;
declare clean_ids uuid[];
begin
  if public.current_role() not in ('mover', 'admin') then
    raise exception 'Funzione riservata ai Mover';
  end if;
  select array_agg(distinct id) into clean_ids
  from unnest(coalesce(p_mover_ids, '{}')) id;
  if coalesce(cardinality(clean_ids), 0) = 0 then raise exception 'Seleziona almeno un Mover'; end if;
  if exists (
    select 1 from unnest(clean_ids) id
    left join public.profiles p on p.id = id
    where p.id is null or p.role <> 'mover' or not p.active
  ) then raise exception 'Uno dei Mover selezionati non è valido o non è attivo'; end if;

  update public.delivery_requests
  set assigned_mover_ids = clean_ids,
      assigned_mover_id = clean_ids[1],
      status = case when status in ('pending', 'approved') then 'assigned' else status end
  where id = p_request_id and status not in ('completed', 'cancelled')
  returning * into updated;
  if updated.id is null then raise exception 'Richiesta non disponibile'; end if;
  return updated;
end;
$$;

grant execute on function public.take_delivery_request(uuid, uuid[]) to authenticated;

create or replace function public.update_delivery_status(p_request_id uuid, p_status public.request_status)
returns public.delivery_requests
language plpgsql security definer set search_path = '' as $$
declare current_request public.delivery_requests;
declare updated public.delivery_requests;
begin
  select * into current_request from public.delivery_requests where id = p_request_id for update;
  if current_request.id is null then raise exception 'Richiesta non trovata'; end if;
  if not public.is_admin() then
    if public.current_role() <> 'mover' or not (auth.uid() = any(current_request.assigned_mover_ids)) then
      raise exception 'Puoi aggiornare soltanto le consegne che stai gestendo';
    end if;
    if not (
      (current_request.status = 'assigned' and p_status = 'picked_up') or
      (current_request.status = 'picked_up' and p_status = 'in_transit') or
      (current_request.status = 'in_transit' and p_status in ('delivered', 'completed')) or
      (current_request.status = 'delivered' and p_status in ('return_required', 'completed')) or
      (current_request.status = 'return_required' and p_status = 'completed')
    ) then raise exception 'Passaggio di stato non consentito'; end if;
  end if;

  update public.delivery_requests set status = p_status where id = p_request_id returning * into updated;
  if p_status = 'delivered' then
    update public.equipment set current_site_id = updated.destination_site_id where id = updated.equipment_id;
  elsif p_status = 'completed' then
    update public.equipment
    set current_site_id = updated.destination_site_id
    where id = updated.equipment_id;
  end if;
  return updated;
end;
$$;
