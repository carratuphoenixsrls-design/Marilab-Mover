# Collaudo E1.6.9 — Push Reliability

## Controlli automatici completati

- installazione riproducibile da `package-lock.json`;
- lint dell’intero frontend;
- TypeScript strict;
- 114 controlli statici su versione, PWA, layout, ruoli, flussi e Push;
- simulazione di 6 scenari multi-dispositivo e 14 invarianti tecniche;
- controllo Deno di tutte le Edge Functions modificate;
- parsing PostgreSQL della migrazione E1.6.9 e del cron;
- validazione locale della configurazione Expo;
- prebuild Android con `POST_NOTIFICATIONS`, package e configurazione Firebase;
- prebuild iOS con bundle ed entitlement `aps-environment`;
- export/bundle Hermes separato per Android e iOS;
- export Web completo e artefatti PWA.

## Scenari simulati

| Scenario | Stati dispositivi | Esito notifica |
|---|---|---|
| Web, Android e iOS consegnati | sent / sent / sent | completed |
| Web consegnato, Android in retry, iOS accettato | sent / retry / accepted | waiting_receipts |
| Android consegnato, browser revocato | sent / invalid | partial |
| Tutti i dispositivi revocati | invalid / invalid | failed |
| Gateway temporaneamente non disponibili | retry / retry / retry | retrying |
| Nessun dispositivo registrato | nessun target | no_targets |

## Meccanismi verificati

- una riga `push_deliveries` per notifica e dispositivo;
- chiave univoca anti-duplicazione;
- claim atomico e lease di 3 minuti;
- massimo 6 tentativi con backoff;
- batch Expo massimo 100 messaggi;
- ricevute Expo controllate dopo 15 minuti;
- TTL 24 ore su Expo e Web Push;
- priorità alta;
- `collapseId`/`tag` per ridurre duplicati visibili;
- gestione token/sottoscrizioni invalidi;
- rinnovo token nativo durante il runtime;
- recupero Web quando il Service Worker segnala un cambio sottoscrizione;
- nuova registrazione al ritorno online/in primo piano;
- test limitato al dispositivo corrente e al relativo proprietario;
- broadcast di sistema riservato agli Admin;
- rate limit e coerenza tra richiesta/chat/aggiornamento e notifica generata.

## Limiti onesti del collaudo

Il codice non può sostituire un test con servizi e dispositivi reali. Dopo il deploy devono essere verificati:

- segreti Supabase effettivi;
- FCM V1 nell’account EAS;
- APNs e firma iOS nell’account EAS;
- browser e versioni OS reali;
- comportamento con Focus/Riepilogo iOS;
- force-stop Android, che può impedire le notifiche fino alla riapertura;
- assenza rete oltre il TTL di 24 ore;
- eventuali disservizi di Expo, FCM, APNs o gateway browser.

Il pacchetto distingue correttamente gli esiti e ritenta quando il problema è tecnicamente recuperabile; non dichiara come consegnata una notifica solo perché un altro dispositivo l’ha ricevuta.
