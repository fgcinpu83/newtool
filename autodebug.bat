@echo off
echo === Autodebug Script ===
echo Running in directory: %CD%
echo.

REM Change to backend directory
cd backend
if %errorlevel% neq 0 (
    echo Failed to cd to backend
    exit /b 1
)

echo === Building backend ===
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    exit /b 1
)
echo ✅ Build successful
echo.

echo === Running tests ===
call npm test
if %errorlevel% neq 0 (
    echo ❌ Tests failed
    exit /b 1
)
echo ✅ Tests passed
echo.

echo === Smoke run ===
start /B npm start
timeout /t 5 /nobreak >nul
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if %errorlevel% neq 0 (
    echo ❌ App failed to start
    exit /b 1
)
echo ✅ App started successfully
taskkill /F /IM node.exe >nul 2>&1

echo 🎉 All checks passed!