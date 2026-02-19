@echo off
:: Auto-log wrapper: if not already running with logging, re-launch self into
:: a new cmd window that redirects stdout/stderr to a logfile so double-click works.
if "%ORCH_LOGGING%"=="" (
    set "ORCH_LOGGING=1"
    set "ORCH_LOGFILE=%~dp0orchestrator_run.log"
    echo Starting orchestrator (logging to %ORCH_LOGFILE%)...
    :: create a temporary wrapper cmd to avoid quoting complexity
    set "ORCH_TMP=%TEMP%\orch_wrapper_%RANDOM%.cmd"
    >"%ORCH_TMP%" echo @echo off
    >>"%ORCH_TMP%" echo "%~f0" %* ^> "%ORCH_LOGFILE%" 2^>^&1
    start "ORCHESTRATOR" cmd /k "%ORCH_TMP%"
    exit /b
)

echo ================================
echo   ANTIGRAVITY MASTER START
echo ================================

:: Accept --force to auto-kill occupying PIDs during preflight
set FORCE=0
if "%~1"=="--force" set FORCE=1
if "%~1"=="/force" set FORCE=1
if "%FORCE%"=="1" (
    echo [INFO] Running in non-interactive mode: --force enabled (auto-kill).
)


REM --- Preflight: port checks and optional kills ---
echo [0/5] Preflight: checking required ports...
setlocal enabledelayedexpansion
set PORTS=6379 3001 8000 3000 9222
for %%P in (%PORTS%) do (
    netstat -ano | findstr :%%P >nul
    if !ERRORLEVEL! EQU 0 (
        echo [PRE] Port %%P is IN USE. Gathering PID(s)...
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%P') do (
            set PID=%%a
            echo [PRE]  - PID=!PID! is listening on port %%P
            tasklist /FI "PID eq !PID!" | findstr /I /C:"!PID!" >nul
            if !ERRORLEVEL! EQU 0 (
                tasklist /FI "PID eq !PID!"
            )
            if !FORCE! EQU 1 (
                echo [PRE] --force enabled: killing PID=!PID! ...
                taskkill /PID !PID! /F >nul 2>&1
                if !ERRORLEVEL! EQU 0 (
                    echo [PRE] PID=!PID! killed.
                ) else (
                    echo [PRE] Failed to kill PID=!PID! - continue anyway.
                )
            ) else (
                echo [PRE]  Enter Y to kill PID=!PID! or N to abort startup.
                set /p KILLCONF=Kill PID=!PID!? (Y/N) : 
                if /I "!KILLCONF!"=="Y" (
                    echo [PRE] Killing PID=!PID! ...
                    taskkill /PID !PID! /F >nul 2>&1
                    if !ERRORLEVEL! EQU 0 (
                        echo [PRE] PID=!PID! killed.
                    ) else (
                        echo [PRE] Failed to kill PID=!PID! - continue anyway.
                    )
                ) else (
                    echo [PRE] Aborting orchestrator due to port %%P occupied.
                    endlocal
                    exit /b 1
                )
            )
        )
    ) else (
        echo [PRE] Port %%P is free.
    )
)
endlocal

echo [1/5] Preflight complete.

REM Start Redis (idempotent)
echo [2/5] Starting Redis (idempotent)...
:: If redis-server is already running we skip start to avoid "bind" errors
tasklist /FI "IMAGENAME eq redis-server.exe" | findstr /I "redis-server.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo [REDIS] already running - skipping start.
) else (
    echo [REDIS] not running - starting...
    start "REDIS" cmd /k "redis-server"
)

REM Start Backend (idempotent)
echo [2/5] Starting Backend (idempotent)...
:: If port 3001 is already in use, skip starting backend to avoid EADDRINUSE
netstat -ano | findstr :3001 >nul
if %ERRORLEVEL% EQU 0 (
    echo [BACKEND] port 3001 already in use - skipping start.
) else (
    echo [BACKEND] not in use - starting backend...
    start "BACKEND" cmd /k "cd backend && npm run start"
)

REM Wait backend boot
timeout /t 5 >nul

REM Start FastAPI single-source service (optional) and wait for healthy
echo [2.5/5] Starting FastAPI single-source service (idempotent)...
:: If port 8000 is already in use, skip starting but still poll health
netstat -ano | findstr :8000 >nul
if %ERRORLEVEL% EQU 0 (
    echo [FASTAPI] port 8000 already in use - skipping start, will poll health.
) else (
    echo [FASTAPI] not in use - starting FastAPI service in background...
    start "FASTAPI" cmd /k "cd backend && python -m uvicorn fastapi_service.app:app --reload --port 8000"
)

:: Poll health endpoint until 200 OK (max 20 retries, 2s interval)
set RETRIES=0
set MAX_RETRIES=20
:wait_fastapi
echo [FASTAPI] checking health (attempt %RETRIES% of %MAX_RETRIES%)...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/system/state' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 2 }"
if %ERRORLEVEL% EQU 0 (
    echo [FASTAPI] healthy (200 OK).
    goto fastapi_ready
)

set /a RETRIES=%RETRIES%+1
if %RETRIES% GEQ %MAX_RETRIES% (
    echo [ERROR] FastAPI did not become healthy after %MAX_RETRIES% attempts.
    echo Check logs in the FASTAPI window or run "cd backend && python -m uvicorn fastapi_service.app:app --reload --port 8000" manually.
    exit /b 1
)

timeout /t 2 >nul
goto wait_fastapi

:fastapi_ready

REM Start Frontend only after backend/fastapi ready
echo [3/5] Starting Frontend (after backend healthy)...
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
