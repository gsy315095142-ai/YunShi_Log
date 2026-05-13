@echo off
setlocal EnableExtensions

rem Run from repo root: check npm, npm install if needed, start backend + frontend + browser
cd /d "%~dp0" || exit /b 1

rem %~dp0 always has trailing \ — build paths without ambiguous "%dp0.xyz" merges
set "ROOT=%~dp0"
set "BACKEND_PY=%ROOT%backend\.venv\Scripts\python.exe"
set "BACKEND_RUN=%ROOT%backend\run-backend.bat"

echo [%TIME%] Checking npm ...
where npm >nul 2>&1
if errorlevel 1 (
  echo.
  echo npm was not found on PATH.
  echo Install Node.js ^(includes npm^) from https://nodejs.org/ then retry.
  echo.
  pause
  exit /b 1
)

if not exist "%BACKEND_PY%" (
  echo.
  echo backend\.venv\Scripts\python.exe not found.
  echo Create the venv and install deps, for example:
  echo   cd /d "%ROOT%backend"
  echo   python -m venv .venv
  echo   .venv\Scripts\pip install -r requirements.txt
  echo.
  pause
  exit /b 1
)

if not exist "%ROOT%frontend\node_modules" (
  echo [%TIME%] frontend\node_modules missing - running npm install ...
  pushd "%ROOT%frontend" || exit /b 1
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. See messages above.
    popd
    pause
    exit /b 1
  )
  popd
  echo [%TIME%] npm install done.
) else (
  echo [%TIME%] node_modules present - skipping npm install ^(delete frontend\node_modules to reinstall^).
)

echo [%TIME%] Starting backend http://127.0.0.1:8000 ...
start "Marketing Materials Backend" cmd.exe /k "cd /d ""%ROOT%backend"" && call ""%BACKEND_RUN%"""
echo [%TIME%] Waiting until API responds at http://127.0.0.1:8000/api/health ^(up to 120s^) ...
echo            ^(Vite starts only after this, so startup will not hammer /api before backend exists.^)
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\wait-api-health.ps1" -TimeoutSeconds 120

if errorlevel 1 (
  echo.
  echo Timed out: backend did not become healthy.
  echo Check window "Marketing Materials Backend": Python import errors or port 8000 in use?
  pause
  exit /b 1
)

echo [%TIME%] Backend is up — starting frontend Vite ^(/api proxies to localhost:8000^) ...
start "Marketing Materials Frontend" cmd.exe /k "cd /d ""%ROOT%frontend"" && npm run dev"

echo [%TIME%] Waiting until Vite listens on port 5173 ^(up to 120s^) ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\wait-tcp-port.ps1" -Port 5173 -TimeoutSeconds 120

if errorlevel 1 (
  echo.
  echo Timed out: Vite ^(5173^) is not open. Check window "Marketing Materials Frontend".
  echo.
  pause
  exit /b 1
)

echo [%TIME%] Opening browser ...
start "" http://127.0.0.1:5173/

endlocal
exit /b 0
