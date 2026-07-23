@echo off
cd /d "%~dp0frontend"
echo [1/2] Building frontend for /sylog/ ...
call npm run build
if errorlevel 1 (
  echo.
  echo ===== BUILD FAILED =====
  pause
  exit /b 1
)

echo.
echo ===== BUILD SUCCESS =====
echo.
echo Upload these files to server:
echo   Local:  %~dp0frontend\dist\
echo   Server: /www/wwwroot/lumiclaw.top/sylog/
echo.
echo Open in browser after upload:
echo   https://www.lumiclaw.top/sylog/
echo.
dir /b "%~dp0frontend\dist"
echo.
pause
