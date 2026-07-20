# Architettura Marilab Mover E1.6.9

## Stack

- React Native + Expo Router;
- export Web/PWA con Expo;
- Supabase Auth, PostgreSQL, RLS ed Edge Functions;
- Vercel per il frontend Web;
- Expo Push per Android e iOS nativi;
- standard Web Push + Service Worker per browser e PWA iPhone/iPad.

## Separazione da FMED

Marilab Mover utilizza il progetto Supabase dedicato `nfiscouwoblfdkppcgcg`. Non legge e non modifica direttamente le tabelle di FMED. L’inventario logistico contiene soltanto gli strumenti necessari ai trasferimenti.

## Ruoli

- **Richiedente:** seleziona lo strumento, la destinazione, data/ora, priorità e note. La sede di ritiro deriva dalla posizione corrente dello strumento.
- **Mover:** prende in carico, ritira e consegna. Visualizza sempre l’ultimo strumento consegnato e la sua posizione aggiornata.
- **Admin:** gestisce utenti, sedi, inventario, assegnazioni, eliminazioni controllate, diagnostica Push e statistiche.

## Dati e sicurezza

Il client usa esclusivamente la chiave pubblica Supabase. Le operazioni privilegiate vengono eseguite dalle Edge Functions dopo la verifica della sessione e del ruolo. Le tabelle applicano RLS. `push_deliveries` è accessibile soltanto alla `service_role`.

## Notifiche affidabili per dispositivo

Ogni evento viene scritto in `app_notifications`. La funzione `enqueuePushDeliveries` crea una riga in `push_deliveries` per ciascun token Expo o endpoint Web attivo del destinatario.

`send-global-push` gestisce:

- lettura configurazione VAPID;
- registrazione/trasferimento sicuro di token nativi e sottoscrizioni Web;
- test mirato al dispositivo corrente;
- invio immediato della coda.

`scheduled-reminders` viene chiamata ogni 15 minuti e gestisce:

- creazione promemoria dovuti;
- retry delle sole consegne fallite temporaneamente;
- controllo delle ricevute Expo;
- chiusura dello stato complessivo della notifica.

Il claim della coda usa `FOR UPDATE SKIP LOCKED`, un lease di 3 minuti e massimo 6 tentativi. Un successo su un dispositivo non chiude gli altri. La chiave privata VAPID rimane esclusivamente nei segreti Supabase.

## Chat

`chat_messages` gestisce chat generale, privata e collegata alla consegna. Sono ammessi soltanto messaggi di testo; non sono previsti file o allegati.

## Mappe

Le sedi contengono indirizzo e query Maps. Il client apre Google Maps con un URL di navigazione; non memorizza dati di traffico.
