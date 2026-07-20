# Notifiche Push E1.6.9

## Architettura

Ogni riga di `app_notifications` genera una o più righe in `push_deliveries`, una per ciascun token Expo o sottoscrizione Web attiva. Gli esiti sono indipendenti: `pending`, `processing`, `accepted`, `sent`, `retry`, `invalid`, `failed` o `cancelled`.

## Android e iOS nativi

- richiedono una build EAS installata; Expo Go Android non è supportato per le notifiche remote;
- il telefono registra un Expo Push Token tramite la Edge Function autenticata;
- Android richiede FCM V1 configurato nell’account EAS;
- iOS richiede APNs e credenziali Apple valide nell’account EAS;
- il ticket Expo viene seguito da una verifica della ricevuta definitiva.

## Browser PC e PWA Android

Aprire “Notifiche push”, premere “Attiva su questo dispositivo”, concedere il permesso e usare “Invia test”. Il Service Worker gestisce notifiche con app aperta, in background o chiusa nei limiti del browser/OS.

## PWA iPhone/iPad

Richiede iOS/iPadOS 16.4 o successivo e installazione dalla schermata Home. Aprire Safari, usare **Condividi > Aggiungi alla schermata Home**, avviare dall’icona e attivare il Push dall’app.

## Retry e scadenza

- massimo 6 tentativi per dispositivo;
- attesa progressiva fino a 1 ora;
- cron ogni 15 minuti;
- TTL Push 24 ore;
- token revocati o endpoint scaduti vengono disattivati.

## Controllo Supabase

```sql
select user_id, platform, active, updated_at
from public.push_tokens
order by updated_at desc;

select user_id, endpoint, active, updated_at
from public.web_push_subscriptions
order by updated_at desc;

select notification_id, provider, user_id, status, attempts,
       next_attempt_at, accepted_at, sent_at, last_error
from public.push_deliveries
order by created_at desc
limit 200;

select id, push_status, push_attempts, push_last_attempt_at,
       push_completed_at, push_sent_at
from public.app_notifications
order by created_at desc
limit 100;
```
