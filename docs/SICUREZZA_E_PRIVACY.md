# Sicurezza e privacy

Autore: **Fabio Carratù**

Marilab Mover conserva dati organizzativi: utenti aziendali, ruoli, sedi, strumenti, richieste, stati, messaggi testuali e storico operativo.

Non devono essere inseriti dati di pazienti, diagnosi, referti, fotografie, audio, documenti clinici, password o altre informazioni riservate.

## Protezioni

- autenticazione Supabase individuale;
- nessuna registrazione pubblica;
- password temporanea e cambio al primo accesso;
- RLS sulle tabelle;
- funzioni Admin e Push verificate lato server;
- nessuna service role o chiave privata VAPID nel client;
- storico operativo e disattivazione account;
- messaggi privati e notifiche private protetti dalle policy.
