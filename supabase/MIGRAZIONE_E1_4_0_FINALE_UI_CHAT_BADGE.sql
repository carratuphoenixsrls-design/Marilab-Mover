-- MARILAB MOVER 1.4.0 - FLUSSO MOVER SEMPLIFICATO
-- Eseguire una sola volta dopo MIGRAZIONE_E1_3_0_FINALE.sql
begin;

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

  if current_request.id is null then raise exception 'Richiesta non trovata'; end if;

  user_is_assigned :=
    current_request.assigned_mover_id = auth.uid()
    or auth.uid() = any(coalesce(current_request.assigned_mover_ids, array[]::uuid[]));

  if not public.is_admin() then
    if public.current_role() <> 'mover' or not user_is_assigned then
      raise exception 'Puoi aggiornare soltanto le consegne che stai gestendo';
    end if;
    if p_status <> 'completed' or current_request.status in ('completed', 'cancelled') then
      raise exception 'Il Mover può soltanto confermare la consegna finale';
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

grant execute on function public.update_delivery_status(uuid, public.request_status) to authenticated;
commit;
