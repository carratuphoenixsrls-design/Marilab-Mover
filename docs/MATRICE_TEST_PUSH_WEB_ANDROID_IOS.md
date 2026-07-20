# Matrice di test Push — Web, Android e iOS

Eseguire dopo database, Edge Functions, cron, Vercel e build native E1.6.9.

## Preparazione

Usare almeno:

- 1 PC Chrome o Edge;
- 1 PWA Android Chrome;
- 1 app Android nativa E1.6.9;
- 1 PWA iPhone installata dalla schermata Home;
- 1 app iOS nativa E1.6.9, quando disponibile;
- lo stesso utente su più dispositivi e almeno un secondo utente.

Per ogni dispositivo premere prima **Attiva su questo dispositivo** e poi **Invia test**.

## Test obbligatori

| ID | Condizione | Risultato atteso |
|---|---|---|
| P01 | Tutti i dispositivi online, app aperte | Tutti ricevono; nessun duplicato |
| P02 | Web aperto, Android in background, iOS chiuso | Tutti i sistemi supportati mostrano la notifica |
| P03 | Browser/PWA chiuso ma non disabilitato | Notifica mostrata dal Service Worker/OS |
| P04 | Un dispositivo offline per meno di 24 ore | Gli altri ricevono subito; quello offline riceve quando il gateway lo consente |
| P05 | Un dispositivo offline oltre 24 ore | Nessuna garanzia di recapito; la notifica scade per TTL |
| P06 | Gateway simulato temporaneamente non disponibile | La consegna resta in retry e viene riprovata dal cron |
| P07 | Token Expo revocato/disinstallazione | Token marcato non valido; altri dispositivi continuano a ricevere |
| P08 | Sottoscrizione browser scaduta | Endpoint disattivato; riattivazione dal dispositivo crea/aggiorna la sottoscrizione |
| P09 | Permesso negato | App mostra errore chiaro; nessun falso “attivo” locale |
| P10 | Permesso revocato dopo la registrazione | Il dispositivo non è garantito; riaprendo l’app compare lo stato negato |
| P11 | Token nativo cambia durante il runtime | Il nuovo token viene registrato automaticamente |
| P12 | Ritorno online o app in primo piano | Registrazione Push ricontrollata senza nuovo prompt |
| P13 | Due invii server contemporanei della stessa notifica | Una sola acquisizione per dispositivo grazie al claim atomico |
| P14 | Web riuscito, Android fallito, iOS accettato | Stato non concluso; retry Android e ricevuta iOS separati |
| P15 | Test Push da un dispositivo | Riceve solo il dispositivo corrente, non tutti quelli dell’utente |
| P16 | Logout e accesso con altro utente sullo stesso dispositivo | Token/endpoint associato correttamente al nuovo utente |
| P17 | Android in modalità risparmio/Doze | Messaggio ad alta priorità; tempi finali dipendono dal sistema |
| P18 | Android forzatamente arrestato dalle impostazioni | Nessuna garanzia finché l’app non viene riaperta |
| P19 | iPhone con Focus/Riepilogo notifiche | Recapito e visibilità dipendono dalle impostazioni iOS |
| P20 | iPhone PWA non installata Home | L’app deve spiegare che l’installazione Home è obbligatoria |

## Test simultaneo finale

1. Accedere con lo stesso utente su Web PC, Android e iPhone.
2. Attivare le notifiche su tutti e tre.
3. Creare una nuova richiesta o cambiare uno stato.
4. Verificare che tutti i dispositivi ricevano la stessa notifica.
5. Spegnere la rete su Android e ripetere.
6. Verificare ricezione immediata su Web/iPhone e stato in coda per Android.
7. Riattivare la rete e attendere il ciclo automatico/gateway.
8. Aprire Diagnostica Push Admin e controllare coda/errori.

## Criterio di accettazione

La release è accettata quando:

- nessuna consegna parziale viene marcata come totalmente completata;
- un dispositivo fallito non impedisce né duplica gli altri;
- retry e ricevute chiudono la coda;
- token revocati vengono esclusi;
- il test locale raggiunge soltanto il dispositivo da cui è stato avviato;
- non restano errori inattesi nella diagnostica dopo il tempo necessario ai retry.
