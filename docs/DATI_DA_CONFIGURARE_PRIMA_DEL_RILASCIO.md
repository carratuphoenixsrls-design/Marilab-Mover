# Dati e credenziali da configurare prima del rilascio

## Supabase

- migrazione E1.6.9 applicata;
- Edge Functions aggiornate;
- VAPID pubblico/privato/subject presenti;
- `CRON_SECRET` presente;
- cron attivo ogni 15 minuti.

## Vercel

- URL e chiave pubblica Supabase corretti;
- eventuale `EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` uguale alla chiave pubblica server;
- dominio HTTPS operativo;
- Service Worker `/sw.js` non servito da cache obsoleta.

## Expo/EAS Android

- progetto `60570208-f4ac-486f-a133-916a11ec42b5` accessibile;
- package `it.marilab.mover`;
- `google-services.json` del progetto Firebase `marilab-mover`;
- credenziale FCM V1 caricata nell’account EAS;
- build E1.6.9/versionCode 17 installata per il test.

## Expo/EAS iOS

- bundle `it.marilab.mover`;
- account Apple Developer valido;
- chiave/certificato APNs configurato in EAS;
- provisioning e firma validi;
- build E1.6.9 installata su dispositivo reale.

## Dati operativi

Per ogni account: nome, email aziendale, ruolo, stato attivo e sede quando prevista. Per ogni sede e apparecchiatura: dati completi e stato attivo. Gli utenti vengono creati dall’Admin; non è prevista registrazione libera.
