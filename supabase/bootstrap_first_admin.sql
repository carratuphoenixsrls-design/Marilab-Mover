-- MARILAB MOVER - PRIMO ADMIN
-- Autore: Fabio Carratù
-- 1) Prima crea l'utente in Supabase Dashboard > Authentication > Users.
-- 2) Usa l'email fabio.carratu@marilab.it e abilita Auto Confirm User.
-- 3) Poi esegui questo script.

insert into public.profiles (id, email, full_name, role, active, must_change_password)
select id, lower(email), 'Fabio Carratù', 'admin', true, true
from auth.users
where lower(email) = 'fabio.carratu@marilab.it'
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = 'admin',
  active = true,
  must_change_password = true;

select id, email, full_name, role, active, must_change_password
from public.profiles
where lower(email) = 'fabio.carratu@marilab.it';
