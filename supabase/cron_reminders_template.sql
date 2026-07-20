-- MARILAB MOVER - CRON PROMEMORIA E RETRY PUSH AUTOMATICI
-- Autore: Fabio Carratù
-- File modello: usare il file cron_reminders_generated.sql creato dal BAT.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'marilab-mover-reminders';

select cron.schedule(
  'marilab-mover-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://nfiscouwoblfdkppcgcg.supabase.co/functions/v1/scheduled-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '__CRON_SECRET__'
    ),
    body := '{}'::jsonb
  );
  $$
);

select jobid, jobname, schedule, active
from cron.job
where jobname = 'marilab-mover-reminders';
