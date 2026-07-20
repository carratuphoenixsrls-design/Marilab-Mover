@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo MARILAB MOVER E1.6.9 - COLLAUDO COMPLETO
echo.
call npm ci --no-audit --no-fund
if errorlevel 1 goto errore
call npm run check
if errorlevel 1 goto errore
echo.
echo LINT, TYPESCRIPT, 110 CONTROLLI, SIMULAZIONE PUSH E BUILD SUPERATI.
pause
exit /b 0
:errore
echo.
echo COLLAUDO INTERROTTO. LEGGI IL MESSAGGIO SOPRA.
pause
exit /b 1
