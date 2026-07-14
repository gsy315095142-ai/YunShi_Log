@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo Installing npm packages, first run may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Freeing port 5173 if occupied by a stale dev server...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo Starting frontend at http://127.0.0.1:5173/sylog/
echo.
call npm run dev

echo.
echo Frontend stopped.
pause
