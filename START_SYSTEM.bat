@echo off
REM === START_SYSTEM.bat ===
REM Single-click starter for backend (minimal), frontend, Chrome, and helpers

setlocal
set "ROOT=%~dp0"
echo = Minimal System Starter =
echo [SYSTEM] Lokasi Skrip: "%ROOT%"

REM 1. Start Backend
if exist "%ROOT%backend" (
    pushd "%ROOT%backend"
    if not exist "node_modules" (
        echo [INFO] Installing backend dependencies...
        npm install
    )
    echo [INFO] Compiling backend TypeScript...
    npm run build
    start "BACKEND" cmd /k "title BACKEND && npm run start"
    popd
) else (
    echo [ERROR] backend folder not found: %ROOT%backend
)

REM 2. Start Frontend
if exist "%ROOT%frontend_new" (
    pushd "%ROOT%frontend_new"
    if not exist "node_modules" (
        echo [INFO] Installing frontend dependencies...
        npm install
    )
    start "FRONTEND" cmd /k "title FRONTEND && npm run dev"
    popd
) else (
    echo [WARN] frontend_new folder not found: %ROOT%frontend_new
)

REM 3. Open Chrome (optional, with extension)
set "CHROME_PATH=%CHROME_PATH%"
if not exist "%CHROME_PATH%" set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set "EXT_PATH=%ROOT%extension_desktop"
set "USER_DATA=%ROOT%userdata"
set "FRONTEND_URL=http://localhost:3000"
if exist "%CHROME_PATH%" (
    start "" "%CHROME_PATH%" --load-extension="%EXT_PATH%" --user-data-dir="%USER_DATA%" --remote-debugging-port=9222 --no-first-run "%FRONTEND_URL%"
) else (
    echo [WARN] Chrome not found, open %FRONTEND_URL% manually
)

echo ✅ ALL START TASKS TRIGGERED. Check separate windows for logs.
pause
endlocal
