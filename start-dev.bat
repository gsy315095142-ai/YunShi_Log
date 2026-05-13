@echo off
setlocal EnableExtensions

rem Run from repo root: check npm, npm install if needed, start backend + frontend + browser
cd /d "%~dp0" || exit /b 1

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

if not exist "%~dp0frontend\node_modules\" (
  echo [%TIME%] frontend\node_modules missing - running npm install ...
  pushd "%~dp0frontend" || exit /b 1
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
start "Marketing-Materials Backend" cmd.exe /k "cd /d ""%~dp0backend"" && ""%~dp0backend\.venv\Scripts\python.exe"" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

echo [%TIME%] Starting frontend Vite ^(/api proxies to backend^) ...
start "Marketing-Materials Frontend" cmd.exe /k "cd /d ""%~dp0frontend"" && npm run dev"

echo [%TIME%] Waiting until 127.0.0.1:5173 accepts connections ^(up to 90s^) ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=[datetime]::UtcNow.AddSeconds(90); while([datetime]::UtcNow -lt $deadline) { $t=$null; try { $t=New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1',5173); if($t.Connected){$t.Close(); exit 0} } catch {} finally { if($null -ne $t){ $t.Dispose() } } Start-Sleep -Milliseconds 500 }; exit 1"
if errorlevel 1 (
  echo.
  echo Timed out: port 5173 is not open. Check window "Marketing-Materials Frontend" for npm errors.
  echo If npm is still installing deps, run this script again after it finishes.
  pause
  exit /b 1
)

echo [%TIME%] Opening default browser at http://127.0.0.1:5173/
rem If you use an IDE embedded preview and see chrome-error / unsafe frame errors, open this URL in Edge or Chrome instead.
start "" http://127.0.0.1:5173/

endlocal
exit /b 0
