@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Su YunShi Log - Local Dev
echo ========================================
echo.

echo [1/3] Starting backend...
start "SuYunShi-Backend" cmd /k "cd /d %~dp0backend && run-backend.bat"

echo [2/3] Waiting for backend...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\wait-api-health.ps1" -Url "http://127.0.0.1:8000/health" -TimeoutSec 90
if errorlevel 1 (
  echo.
  echo Backend failed to start. Check the SuYunShi-Backend window.
  pause
  exit /b 1
)

echo [3/3] Starting frontend...
start "SuYunShi-Frontend" cmd /k "cd /d %~dp0frontend && run-frontend.bat"

echo.
echo ========================================
echo   Ready - open in browser:
echo   http://127.0.0.1:5173/sylog/
echo.
echo   API docs: http://127.0.0.1:8000/docs
echo   Login: Guosy / 1234567890
echo ========================================
echo.
echo Keep both terminal windows open while testing.
echo Close those windows to stop servers.
echo.
pause
