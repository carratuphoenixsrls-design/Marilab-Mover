-- Marilab Mover E1.0.2
-- Corregge il pulsante "Ritiro effettuato" anche per le missioni create/assegnate
-- con versioni precedenti che valorizzavano solo assigned_mover_id.

-- Allinea le vecchie missioni al nuovo campo squadra.
update public.delivery_requests
set assigned_mover_ids = array[assigned_mover_id]::uuid[]
where assigned_mover_id is not null
  and coalesce(cardinality(assigned_mover_ids), 0) = 0;

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
  select * into current_request
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
      (current_request.status in ('pending', 'approved', 'assigned') and p_status = 'picked_up') or
      (current_request.status = 'picked_up' and p_status = 'in_transit') or
      (current_request.status = 'in_transit' and p_status in ('delivered', 'completed')) or
      (current_request.status = 'delivered' and p_status = 'completed')
    ) then
      raise exception 'Passaggio di stato non consentito: % -> %', current_request.status, p_status;
    end if;
  end if;

  update public.delivery_requests
  set
    status = p_status,
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

grant execute on function public.update_delivery_status(uuid, public.request_status) to authenticated;
notify pgrst, 'reload schema';
