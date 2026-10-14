@echo off
title Chia Se Cong Cu Ra Internet - Google Form Submitter
cd /d "%~dp0"

echo ========================================================
echo    CHIA SE CONG CU GOOGLE FORM RA INTERNET (ONLINE)
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tu https://nodejs.org/
    pause
    exit /b 1
)

echo [1/2] Dang khoi dong may chu web tren may...
start /b node server.js >nul 2>&1

echo [2/2] Dang tao duong link HTTPS cong khai (Localtunnel)...
echo.
echo ========================================================
echo    LINK CONG KHAI CHO MOI NGUOI SE HIEN BEN DUOI:
echo    (Gui link nay cho ban be vao dien thoai/may tinh khac)
echo ========================================================
echo.

npx localtunnel --port 3000
pause
