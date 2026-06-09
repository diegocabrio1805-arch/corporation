@echo off
title ANEXO COBRO - Servidor Local (5178)
color 0A
echo.
echo  ============================================
echo   ANEXO COBRO - Iniciando servidor local...
echo  ============================================
echo.
echo  Puerto: http://localhost:5178
echo.

cd /d "C:\Users\Usuario\.antigravity\cobros"

:: Abre el navegador automaticamente tras 4 segundos
start "" cmd /c "timeout /t 4 >nul && start http://localhost:5178"

:: Inicia el servidor Vite
npm run dev

pause
