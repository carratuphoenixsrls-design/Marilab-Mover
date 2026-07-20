-- MARILAB MOVER E0.4 - DATI INIZIALI FACOLTATIVI
-- Autore: Fabio Carratù
-- Eseguire dopo schema.sql. Verificare e correggere indirizzi/referenti prima dell'uso reale.

insert into public.sites (id, name, short_name, address, maps_query, active) values
('11111111-1111-4111-8111-111111111111', 'Marilab Center – Ostia', 'Ostia', 'Viale Alfredo Zambrini 14, 00121 Roma RM', 'Viale Alfredo Zambrini 14, 00121 Roma RM', true),
('22222222-2222-4222-8222-222222222222', 'Marilab Garbatella', 'Garbatella', 'Via Caffaro 137, 00154 Roma RM', 'Via Caffaro 137, 00154 Roma RM', true),
('33333333-3333-4333-8333-333333333333', 'Future Labs – Pomezia', 'Pomezia', 'Pomezia, Città metropolitana di Roma', 'Future Labs Pomezia Roma', true),
('44444444-4444-4444-8444-444444444444', 'Marilab Fiumicino', 'Fiumicino', 'Foce Micina, Fiumicino RM', 'Marilab Foce Micina Fiumicino', true),
('55555555-5555-4555-8555-555555555555', 'Marilab Surgery', 'Surgery', 'Lido di Ostia, Roma RM', 'Marilab Surgery Lido di Ostia Roma', true)
on conflict (id) do nothing;

insert into public.equipment (inventory_code, name, brand, home_site_id, current_site_id, movable, active, accessories) values
('MOV-0001', 'Fibroscan', 'Echosens', '55555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555', true, true, array['Sonda','Alimentatore','Valigia']),
('MOV-0002', 'VIDIX', null, '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', true, true, array['Unità principale','Cavi','Pedale']),
('MOV-0003', 'OCT', null, '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', true, true, array['PC dedicato','Cavo alimentazione']),
('MOV-0004', 'Campo visivo', null, '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', true, true, array['Pulsante paziente','Stampante']),
('MOV-0005', 'Elettromiografo', null, '33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', true, true, array['Elettrodi','Cavi paziente','Alimentatore']),
('MOV-0006', 'ECG Touch', null, '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', true, true, array['Cavo paziente','Elettrodi','Carta'])
on conflict (inventory_code) do nothing;
