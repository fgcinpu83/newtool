@echo off
REM ============================================
REM  ANTIGRAVITY - Chrome Launcher
REM  Launch Chrome with Remote Debugging Port
REM ============================================

title Antigravity Chrome Launcher

REM Kill existing Chrome instances (optional - comment out if you want to keep existing)
REM taskkill /F /IM chrome.exe >nul 2>&1

REM Chrome path (adjust if needed)
set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"

REM Alternative paths (uncomment if needed)
REM set CHROME_PATH="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
REM set CHROME_PATH="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

REM User data directory (separate profile for arbitrage)
set USER_DATA="E:\newtool\chrome_profile"

REM Remote debugging port
set DEBUG_PORT=9222

echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║         ANTIGRAVITY CHROME LAUNCHER               ║
echo  ╠═══════════════════════════════════════════════════╣
echo  ║  Debug Port  : %DEBUG_PORT%                              ║
echo  ║  Profile     : %USER_DATA%              ║
echo  ╚═══════════════════════════════════════════════════╝
echo.

REM Launch Chrome with debugging enabled
start "" %CHROME_PATH% ^
    --remote-debugging-port=%DEBUG_PORT% ^
    --user-data-dir=%USER_DATA% ^
    --no-first-run ^
    --no-default-browser-check ^
    --disable-background-timer-throttling ^
    --disable-backgrounding-occluded-windows ^
    --disable-renderer-backgrounding ^
    --disable-features=TranslateUI ^
    --flag-switches-begin ^
    --flag-switches-end

echo.
echo  [OK] Chrome launched with remote debugging on port %DEBUG_PORT%
echo.
echo  Next steps:
echo  1. Login to your sportsbook accounts in separate tabs
echo  2. Use your whitelabel URLs when prompted by the extension
echo  3. Run ORCHESTRATOR_MASTER.bat to start backend and frontend
echo.
echo  DevTools Protocol: http://localhost:%DEBUG_PORT%/json
echo.
pause
