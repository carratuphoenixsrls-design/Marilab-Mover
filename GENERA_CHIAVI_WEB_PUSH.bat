@echo off
setlocal
cd /d "%~dp0"
echo.
echo MARILAB MOVER - GENERAZIONE CHIAVI WEB PUSH VAPID
echo.
echo ATTENZIONE: non caricare la chiave PRIVATA su GitHub.
echo.
call npx web-push@3.6.7 generate-vapid-keys --json
if errorlevel 1 goto errore
echo.
echo Copia PUBLIC KEY nei segreti Supabase; su Vercel e facoltativa se il client la recupera dal server.
echo Copia PRIVATE KEY soltanto nei segreti Supabase.
pause
exit /b 0
:errore
echo.
echo Generazione non riuscita. Verifica la connessione Internet e Node.js.
pause
exit /b 1
