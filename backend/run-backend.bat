@echo off
setlocal EnableExtensions

rem Starts FastAPI via the venv interpreter.
rem Wrong: python ".venv\Scripts\python.exe" ..  (EXE loaded as script = SyntaxError)
rem Right: "%CD%\.venv\Scripts\python.exe" -m uvicorn ...

cd /d "%~dp0"

set "PYTHON_EXE=%CD%\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
  echo.
  echo [.venv missing] Expected: "%PYTHON_EXE%"
  echo Fix from this folder ^(examples^):
  echo   python -m venv .venv
  echo   .venv\Scripts\pip install -r requirements.txt
  echo.
  pause
  exit /b 1
)

echo Starting Uvicorn at http://127.0.0.1:8000
"%PYTHON_EXE%" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
