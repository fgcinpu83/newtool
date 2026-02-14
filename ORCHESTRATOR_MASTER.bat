@echo off
echo ================================
echo   ANTIGRAVITY MASTER START
echo ================================

REM Start Redis (idempotent)
echo [1/5] Starting Redis (idempotent)...
:: If redis-server is already running we skip start to avoid "bind" errors
tasklist /FI "IMAGENAME eq redis-server.exe" | findstr /I "redis-server.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo [REDIS] already running — skipping start.
) else (
    echo [REDIS] not running — starting...
    start "REDIS" cmd /k "redis-server"
)

REM Start Backend (idempotent)
echo [2/5] Starting Backend (idempotent)...
:: If port 3001 is already in use, skip starting backend to avoid EADDRINUSE
netstat -ano | findstr :3001 >nul
if %ERRORLEVEL% EQU 0 (
    echo [BACKEND] port 3001 already in use — skipping start.
) else (
    echo [BACKEND] not in use — starting backend...
    start "BACKEND" cmd /k "cd backend && npm run start"
)

REM Wait backend boot
timeout /t 5 >nul

REM Start Frontend
echo [3/5] Starting Frontend...
start "FRONTEND" cmd /k "cd frontend_new && npm run dev"

REM Launch Chrome Remote Debugging
echo [4/5] Launching Chrome with remote debugging...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
 --remote-debugging-port=9222 ^
 --user-data-dir="E:\newtool\chrome-profile" ^
 --load-extension="E:\newtool\extension_desktop"

echo ================================
echo   SYSTEM FULLY STARTED
echo ================================
