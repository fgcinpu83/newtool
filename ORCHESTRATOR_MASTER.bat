@echo off
echo ================================
echo   ANTIGRAVITY MASTER START
echo ================================

REM Start Redis
echo [1/5] Starting Redis...
start "REDIS" cmd /k "redis-server"

REM Start Backend
echo [2/5] Starting Backend...
start "BACKEND" cmd /k "cd backend && npm run start"

REM Wait backend boot
timeout /t 5 >nul

REM Start Frontend
echo [3/5] Starting Frontend...
start "FRONTEND" cmd /k "cd frontend_new && npm run dev"

REM Launch Chrome Remote Debugging
echo [4/5] Launching Chrome with remote debugging...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
 --remote-debugging-port=9222 ^
 --user-data-dir="E:\new tools\chrome-profile" ^
 --load-extension="E:\new tools\extension_desktop"

echo ================================
echo   SYSTEM FULLY STARTED
echo ================================
