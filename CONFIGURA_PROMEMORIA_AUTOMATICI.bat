@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ==================================================
echo   MARILAB MOVER E1.6.9 - PROMEMORIA, RETRY E RICEVUTE PUSH
echo   Autore: Fabio Carratu
echo ==================================================
echo.
for /f %%i in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"') do set CRON_SECRET=%%i
if "%CRON_SECRET%"=="" goto errore

echo Collegamento al progetto Supabase...
call npx supabase@latest login
if errorlevel 1 goto errore
call npx supabase@latest link --project-ref nfiscouwoblfdkppcgcg
if errorlevel 1 goto errore

echo Configurazione segreto server...
call npx supabase@latest secrets set CRON_SECRET=%CRON_SECRET%
if errorlevel 1 goto errore

echo Pubblicazione funzione promemoria/retry...
call npx supabase@latest functions deploy scheduled-reminders --no-verify-jwt
if errorlevel 1 goto errore

powershell -NoProfile -Command "$c=Get-Content -Raw 'supabase\cron_reminders_template.sql'; $c=$c.Replace('__CRON_SECRET__','%CRON_SECRET%'); Set-Content -Encoding UTF8 'supabase\cron_reminders_generated.sql' $c"
if errorlevel 1 goto errore

echo.
echo Funzione configurata con esecuzione ogni 15 minuti.
echo Ora apri Supabase SQL Editor ed esegui:
echo   supabase\cron_reminders_generated.sql
echo.
echo Dopo l'esecuzione elimina il file generato, perche contiene il segreto Cron.
pause
exit /b 0

:errore
echo.
echo Configurazione non completata. Controlla connessione, login e permessi Supabase.
pause
exit /b 1
