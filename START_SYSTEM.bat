@echo off
REM DEPRECATED: `START_SYSTEM.bat` is deprecated and disabled.
REM Use `ORCHESTRATOR_MASTER.bat` (master orchestrator) to start the system.

echo ==============================================
echo WARNING: `START_SYSTEM.bat` has been deprecated.
echo Please use `ORCHESTRATOR_MASTER.bat` to start the system.
echo Example:   ORCHESTRATOR_MASTER.bat
echo ==============================================

echo.
echo Backing up existing START_SYSTEM.bat as START_SYSTEM.deprecated.bak
if not exist "%~dp0START_SYSTEM.deprecated.bak" copy "%~dp0START_SYSTEM.bat" "%~dp0START_SYSTEM.deprecated.bak" >nul 2>&1

echo Exiting (no action taken).
pause
exit /b 0
if not exist "%~dp0START_SYSTEM.bak" copy "%~dp0START_SYSTEM.bat" "%~dp0START_SYSTEM.bak" >nul 2>&1

echo.
echo = Antigravity Orbit Starter v3.2.0 =
echo Single-click starter: Backend, Frontend, optional Chrome + helpers.
echo.

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] 'npm' tidak ditemukan! Pastikan Node.js sudah diinstal.
    pause
    exit /b
)

pushd "%~dp0"
set "ROOT=%~dp0"
echo [SYSTEM] Lokasi Skrip: "%ROOT%"
echo.

:: 0. Redis: manual instruction (automatic Docker startup removed for compatibility)
echo [0] Redis: automatic start disabled. Start Redis manually if needed (port 6379).
:: Show redis status so operator knows whether Redis is already running (avoids duplicate-start attempts)
tasklist /FI "IMAGENAME eq redis-server.exe" | findstr /I "redis-server.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo [REDIS] detected (already running).
) else (
    echo [REDIS] not detected. Start it manually: "C:\Program Files\Redis\redis-server.exe"
)

call :START_BACKEND
call :START_FRONTEND

echo.
echo Waiting for services to warm up...
timeout /t 10 /nobreak >nul

call :OPEN_CHROME
call :START_HELPERS

echo.
echo ✅ ALL START TASKS TRIGGERED. Check separate windows for logs.
echo.
pause

goto :eof

:START_BACKEND
echo.
echo [1] Starting backend (compile -> start)
if not exist "%ROOT%backend" (
    echo [ERROR] backend folder not found: %ROOT%backend
    goto :eof
)
:: Skip starting if port 3001 is already in use (prevents EADDRINUSE)
netstat -ano | findstr :3001 >nul
if %ERRORLEVEL% EQU 0 (
    echo [BACKEND] port 3001 appears to be in use — skipping start. If you want to restart, stop the existing process first.
    goto :SKIP_BACKEND_START
)
pushd "%ROOT%backend"
if not exist "node_modules" (
    echo [INFO] Installing backend dependencies...
    npm install
)
echo [INFO] Compiling TypeScript
start "AG-BACKEND-BUILD" cmd /k "title AG-BACKEND-BUILD && npx tsc --project tsconfig.json && echo [BUILD] Done && pause"
timeout /t 2 /nobreak >nul
start "AG-BACKEND" cmd /k "title AG-BACKEND && npx tsc --project tsconfig.json && npm run start"
popd
goto :eof
:SKIP_BACKEND_START
	echo [INFO] Backend start skipped.
goto :eof

:START_FRONTEND
echo.
echo [2] Starting frontend
if not exist "%ROOT%frontend_new" (
    echo [WARN] frontend_new folder not found: %ROOT%frontend_new
    goto :eof
)
pushd "%ROOT%frontend_new"
if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies...
    npm install
)
REM try npm start, otherwise run dev
npm run --silent start >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "AG-FRONTEND" cmd /k "title AG-FRONTEND && npm run start"
) else (
    start "AG-FRONTEND" cmd /k "title AG-FRONTEND && npm run dev"
)
popd
goto :eof

:OPEN_CHROME
echo.
echo [3] Opening Chrome with extension (optional)
set "CHROME_PATH=%CHROME_PATH%"
if not exist "%CHROME_PATH%" set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set "EXT_PATH=%ROOT%extension_desktop"
set "USER_DATA=%ROOT%userdata"
if "%FRONTEND_URL%"=="" set "FRONTEND_URL=http://localhost:3000"
if exist "%CHROME_PATH%" (
    start "" "%CHROME_PATH%" --load-extension="%EXT_PATH%" --user-data-dir="%USER_DATA%" --remote-debugging-port=9222 --no-first-run "%FRONTEND_URL%"
) else (
    echo [WARN] Chrome not found, open %FRONTEND_URL% manually
)
goto :eof

:START_HELPERS
echo.
echo [4] Starting helper scripts if present
if exist "%ROOT%backend\socketio_gateway.js" (
    start "AG-SOCKETIO" cmd /k "title AG-SOCKETIO && node \"%ROOT%backend\socketio_gateway.js\""
) else (
    echo [INFO] socketio_gateway.js not found
)
goto :eof
