@echo off
REM === START_SYSTEM.bat ===

REM use delayed expansion so we can capture working dir inside parentheses
setlocal enabledelayedexpansion
set "ROOT=%~dp0"
echo ==============================
echo = Minimal System Starter =
echo ==============================
echo [SYSTEM] Lokasi Skrip: "%ROOT%"

REM 1. Start Backend
if exist "%ROOT%backend" (
    pushd "%ROOT%backend"

    if not exist "node_modules" (
        echo [INFO] Installing backend dependencies...
        npm install
    )

    echo [INFO] Compiling backend...
    npm run build

    start "BACKEND" cmd /k cd /d "!CD!" ^&^& title BACKEND ^&^& npm run start
    popd
) else (
    echo [ERROR] backend folder not found.
)

REM 2. Start Frontend
if exist "%ROOT%frontend_new" (
    pushd "%ROOT%frontend_new"

    if not exist "node_modules" (
        echo [INFO] Installing frontend dependencies...
        npm install
    )

    start "FRONTEND" cmd /k cd /d "!CD!" ^&^& title FRONTEND ^&^& npm run dev
    popd
) else (
    echo [WARN] frontend_new folder not found.
)

REM 3. Chrome
if defined CHROME_PATH (
    set "CHROME_EXE=%CHROME_PATH%"
) else (
    set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

set "EXT_PATH=%ROOT%extension_desktop"
set "USER_DATA=%ROOT%userdata"
set "FRONTEND_URL=http://localhost:3000"

if exist "%CHROME_EXE%" (
    start "" "%CHROME_EXE%" --load-extension="%EXT_PATH%" --user-data-dir="%USER_DATA%" --remote-debugging-port=9222 --no-first-run "%FRONTEND_URL%"
) else (
    echo [WARN] Chrome not found.
)

echo.
echo All services triggered.
pause
endlocal
