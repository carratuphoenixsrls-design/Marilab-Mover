@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo MARILAB MOVER E1.6.9 - DEPLOY FRONTEND VERCEL PNPM FIX
echo Cartella corrente: %CD%
echo.
if not exist package.json goto cartella_errata
call npm run check
if errorlevel 1 goto errore
call npx vercel@latest --prod --force
if errorlevel 1 goto errore
echo.
echo DEPLOY VERCEL COMPLETATO.
echo Verifica: https://marilab-mover.vercel.app
pause
exit /b 0
:cartella_errata
echo ERRORE: package.json non trovato. Esegui questo file dalla cartella dell'app.
pause
exit /b 1
:errore
echo.
echo COLLAUDO O DEPLOY NON COMPLETATO. LEGGI IL MESSAGGIO SOPRA.
pause
exit /b 1
