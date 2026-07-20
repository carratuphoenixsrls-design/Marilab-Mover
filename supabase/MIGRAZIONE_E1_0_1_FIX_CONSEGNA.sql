-- Marilab Mover E1.0.1
-- Corregge la chiusura diretta della missione: In viaggio -> Completata.
-- Dopo la consegna lo strumento risulta nella sede di destinazione.

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
begin
  select * into current_request
  from public.delivery_requests
  where id = p_request_id
  for update;

  if current_request.id is null then
    raise exception 'Richiesta non trovata';
  end if;

  if not public.is_admin() then
    if public.current_role() <> 'mover'
       or not (auth.uid() = any(current_request.assigned_mover_ids)) then
      raise exception 'Puoi aggiornare soltanto le consegne che stai gestendo';
    end if;

    if not (
      (current_request.status = 'assigned' and p_status = 'picked_up') or
      (current_request.status = 'picked_up' and p_status = 'in_transit') or
      (current_request.status = 'in_transit' and p_status in ('delivered', 'completed')) or
      (current_request.status = 'delivered' and p_status = 'completed')
    ) then
      raise exception 'Passaggio di stato non consentito';
    end if;
  end if;

  update public.delivery_requests
  set status = p_status
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
