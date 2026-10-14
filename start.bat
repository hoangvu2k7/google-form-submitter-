@echo off
title Google Form Auto-Submitter
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tu https://nodejs.org/
    pause
    exit /b 1
)

node server.js
pause
