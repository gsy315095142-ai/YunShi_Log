@echo off
setlocal
cd /d "%~dp0"

echo Starting backend...
start "SuYunShi-Backend" cmd /k "cd /d %~dp0backend && run-backend.bat"

echo Waiting for backend health...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\wait-api-health.ps1" -Url "http://127.0.0.1:8000/health" -TimeoutSec 60
if errorlevel 1 (
  echo Backend did not become healthy in time.
  exit /b 1
)

echo Starting frontend...
start "SuYunShi-Frontend" cmd /k "cd /d %~dp0frontend && npm install && npm run dev"

echo.
echo Dev servers starting:
echo   Backend:  http://127.0.0.1:8000
echo   Frontend: http://127.0.0.1:5173
echo Default admin: Guosy / 1234567890
