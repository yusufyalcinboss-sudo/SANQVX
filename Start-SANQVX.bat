@echo off
setlocal
cd /d "%~dp0"

set "PY_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PY_CMD=py -3"
if not defined PY_CMD where python >nul 2>nul
if not errorlevel 1 if not defined PY_CMD set "PY_CMD=python"
if not defined PY_CMD where python3 >nul 2>nul
if not errorlevel 1 if not defined PY_CMD set "PY_CMD=python3"

if not defined PY_CMD (
    echo Python 3 is required to start SANQVX.
    echo Install Python from https://www.python.org/downloads/ and try again.
    pause
    exit /b 1
)

start "SANQVX local web server" %PY_CMD% -m http.server 8765 --bind 127.0.0.1
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8765/"
echo SANQVX is running in your browser.
echo Keep the SANQVX local web server window open while you use the app.
endlocal
