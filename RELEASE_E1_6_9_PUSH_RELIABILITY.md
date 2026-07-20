# Marilab Mover E1.6.9 — Push Reliability Multi‑Device

## Obiettivo

Rendere l’invio delle notifiche indipendente per ciascun dispositivo e affidabile in presenza di Web/PWA, Android e iOS usati contemporaneamente.

## Problemi eliminati

1. **Consegna parziale nascosta** — prima una riuscita poteva marcare l’intera notifica come inviata; ora ogni dispositivo ha il proprio stato.
2. **Invii doppi concorrenti** — la coda viene acquisita atomicamente con lease e `SKIP LOCKED`.
3. **Mancanza di retry selettivo** — i soli dispositivi falliti vengono ritentati fino a 6 volte.
4. **Ticket Expo scambiato per consegna definitiva** — i ticket accettati vengono verificati tramite ricevute.
5. **Token revocati ancora attivi** — `DeviceNotRegistered`, endpoint 404/410 e sottoscrizioni da rinnovare vengono disattivati.
6. **Test inviato a tutti i dispositivi** — il test ora punta al browser o telefono corrente.
7. **Cambio token non intercettato** — listener nativo e registrazione al ritorno online/in foreground.
8. **Coda vecchia bloccante** — lo storico precedente alla release non viene reinviato e non blocca le notifiche recenti.
9. **Risposta gateway incompleta** — viene trattata come errore temporaneo e ritentata, non come fallimento definitivo.
10. **Invii manuali abusivi** — broadcast di sistema riservati agli Admin, test vincolati al proprio dispositivo, rate limit e coerenza con l’azione applicativa appena eseguita.

## Versioni

- App: **1.6.9**
- Android `versionCode`: **17**
- Expo SDK: **57**
- Package Android: `it.marilab.mover`
- Bundle iOS: `it.marilab.mover`
- Autore: **Fabio Carratù**
