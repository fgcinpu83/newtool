@echo off
TITLE Antigravity Orchestrator Debug Starter
SETLOCAL EnableDelayedExpansion

echo Debug starter: create logs and start backend/frontend (no UI blocking)
set "ROOT=%~dp0"

if not exist "%ROOT%logs" mkdir "%ROOT%logs"

echo [DBG] Starting backend build and run (logs to logs\\backend-*.log)
pushd "%ROOT%backend"
echo [DBG-BACKEND] Running TypeScript compile...
npx tsc --project tsconfig.json > "%ROOT%logs%\backend-build.log" 2>&1
echo [DBG-BACKEND] Launching backend (node dist/src/main.js)...
start "DBG-BACKEND" cmd /c "cd /d \"%ROOT%backend\" && node dist\\src\\main.js > \"%ROOT%logs%\\backend.log\" 2>&1"
popd

echo [DBG] Starting frontend (logs to logs\\frontend.log)
if exist "%ROOT%frontend_new" (
  pushd "%ROOT%frontend_new"
  echo [DBG-FRONTEND] Ensure deps installed...
  npm install --no-audit --no-fund > "%ROOT%logs%\frontend-npm.log" 2>&1
  echo [DBG-FRONTEND] Launching Next dev on port 3000...
  start "DBG-FRONTEND" cmd /c "cd /d \"%ROOT%frontend_new\" && npx next dev --hostname 0.0.0.0 --port 3000 > \"%ROOT%logs%\\frontend.log\" 2>&1"
  popd
) else (
  echo [DBG-FRONTEND] frontend_new folder not found
)

echo [DBG] Debug starter launched. Tail logs in %ROOT%logs\n
goto :eof
