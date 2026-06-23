@echo off
setlocal
cd /d "%~dp0"
echo AFK Beauty Clinic Smart Dashboard
echo.
echo Membuka server lokal di http://localhost:8080
echo Tekan Ctrl+C untuk menutup server.
echo.
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8080"
  python -m http.server 8080
  exit /b
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8080"
  py -3 -m http.server 8080
  exit /b
)
echo Python tidak ditemukan. Buka index.html langsung, atau install Python untuk mode PWA localhost.
pause
