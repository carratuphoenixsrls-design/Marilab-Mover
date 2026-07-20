@echo off
setlocal
cd /d "%~dp0"
echo.
echo MARILAB MOVER - CONFIGURAZIONE SEGRETI WEB PUSH SUPABASE
echo.
set /p VAPID_PUBLIC=Incolla la chiave PUBBLICA VAPID: 
set /p VAPID_PRIVATE=Incolla la chiave PRIVATA VAPID: 
set /p VAPID_SUBJECT=Inserisci il subject, ad esempio mailto:assistenza@azienda.it: 
if "%VAPID_PUBLIC%"=="" goto errore
if "%VAPID_PRIVATE%"=="" goto errore
if "%VAPID_SUBJECT%"=="" goto errore
call npx supabase@latest login
if errorlevel 1 goto errore
call npx supabase@latest link --project-ref nfiscouwoblfdkppcgcg
if errorlevel 1 goto errore
call npx supabase@latest secrets set WEB_PUSH_VAPID_PUBLIC_KEY="%VAPID_PUBLIC%" WEB_PUSH_VAPID_PRIVATE_KEY="%VAPID_PRIVATE%" WEB_PUSH_VAPID_SUBJECT="%VAPID_SUBJECT%"
if errorlevel 1 goto errore
echo.
echo SEGRETI CONFIGURATI. Non salvare le chiavi private nel repository.
pause
exit /b 0
:errore
echo.
echo Configurazione interrotta o dati mancanti.
pause
exit /b 1
