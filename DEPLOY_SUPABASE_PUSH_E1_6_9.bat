@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo MARILAB MOVER E1.6.9 - DEPLOY PUSH E PROMEMORIA
echo Progetto: nfiscouwoblfdkppcgcg
echo.
echo PRIMA DI CONTINUARE: applica una sola volta nel SQL Editor:
echo supabase\MIGRAZIONE_E1_6_9_PUSH_RELIABILITY.sql
echo.
pause
call npx supabase@latest login
if errorlevel 1 goto errore
call npx supabase@latest link --project-ref nfiscouwoblfdkppcgcg
if errorlevel 1 goto errore
call npx supabase@latest functions deploy send-global-push
if errorlevel 1 goto errore
call npx supabase@latest functions deploy scheduled-reminders --no-verify-jwt
if errorlevel 1 goto errore
echo.
echo EDGE FUNCTIONS E1.6.9 PUBBLICATE CORRETTAMENTE.
echo Ora esegui CONFIGURA_PROMEMORIA_AUTOMATICI.bat.
pause
exit /b 0
:errore
echo.
echo DEPLOY NON COMPLETATO. LEGGI IL MESSAGGIO SOPRA.
pause
exit /b 1
