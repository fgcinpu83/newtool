@echo off
TITLE Antigravity System Starter v5.0
SETLOCAL EnableDelayedExpansion

set "ROOT=%~dp0"

echo.
echo  ======================================================
echo    ANTIGRAVITY SYSTEM STARTER v5.0
echo  ======================================================
echo    Backend (NestJS :3001) + Frontend (Next.js :3000)
echo    Chrome + Extension (CDP :9222)
echo  ======================================================
echo.
echo [SYSTEM] Lokasi: "%ROOT%"
echo.

REM === Accept --force flag ===
set FORCE=0
if "%~1"=="--force" set FORCE=1
if "%~1"=="/force" set FORCE=1

REM ============================================================
REM 0. PREFLIGHT — cek npm
REM ============================================================
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm tidak ditemukan! Pastikan Node.js sudah terinstall.
    pause
    exit /b 1
)
echo [OK] npm ditemukan.

REM ============================================================
REM 1. PREFLIGHT — cek port 3001, 3000, 9222
REM ============================================================
echo.
echo [1/5] Preflight: cek port 3001, 3000, 9222...
for %%P in (3001 3000 9222) do (
    netstat -ano | findstr ":%%P " >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        echo [WARN] Port %%P sedang digunakan.
        if !FORCE! EQU 1 (
            for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P "') do (
                echo [PRE]  Killing PID=%%a pada port %%P ...
                taskkill /PID %%a /F >nul 2>&1
            )
        ) else (
            echo [INFO] Gunakan flag --force untuk auto-kill, atau tutup proses secara manual.
        )
    ) else (
        echo [OK] Port %%P bebas.
    )
)

REM ============================================================
REM 2. REDIS via Docker (opsional)
REM ============================================================
echo.
echo [2/5] Memeriksa Redis (Docker)...
where docker >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    docker ps --format "{{.Names}}" 2>nul | findstr /I "redis-local" >nul 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo [INFO] Redis container tidak ditemukan. Memulai redis-local...
        docker run -d --name redis-local -p 6379:6379 redis:7 >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            echo [OK] Redis container started.
        ) else (
            echo [WARN] Gagal memulai Redis container. Mungkin sudah ada tapi stopped.
            docker start redis-local >nul 2>&1
        )
    ) else (
        echo [OK] Redis container redis-local sudah berjalan.
    )
) else (
    echo [INFO] Docker tidak ditemukan. Pastikan Redis berjalan jika diperlukan.
)

REM ============================================================
REM 3. START BACKEND — build lalu start:prod
REM ============================================================
echo.
echo [3/5] Menjalankan Backend (NestJS :3001)...
if exist "%ROOT%backend" (
    pushd "%ROOT%backend"

    if not exist "node_modules" (
        echo [INFO] Installing backend dependencies...
        call npm install
        if !ERRORLEVEL! NEQ 0 (
            echo [ERROR] npm install backend gagal!
            popd
            goto :frontend
        )
    )

    echo [INFO] Compiling backend (npm run build)...
    call npm run build
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Backend build gagal! Periksa TypeScript errors.
        popd
        goto :frontend
    )
    echo [OK] Backend compiled ke dist/

    REM Jalankan backend dengan compiled output (start:prod)
    set "BACKEND_DIR=!CD!"
    start "AG-BACKEND" cmd /k "cd /d "!BACKEND_DIR!" && title AG-BACKEND && npm run start:prod"
    echo [OK] Backend started (start:prod).
    popd
) else (
    echo [ERROR] Folder backend tidak ditemukan di: "%ROOT%backend"
)

REM Tunggu backend siap sebelum frontend
echo [INFO] Menunggu backend siap (5 detik)...
timeout /t 5 /nobreak >nul

REM ============================================================
REM 4. START FRONTEND — npm run dev
REM ============================================================
:frontend
echo.
echo [4/5] Menjalankan Frontend (Next.js :3000)...
if exist "%ROOT%frontend_new" (
    pushd "%ROOT%frontend_new"

    if not exist "node_modules" (
        echo [INFO] Installing frontend dependencies...
        call npm install
        if !ERRORLEVEL! NEQ 0 (
            echo [ERROR] npm install frontend gagal!
            popd
            goto :chrome
        )
    )

    set "FRONTEND_DIR=!CD!"
    start "AG-FRONTEND" cmd /k "cd /d "!FRONTEND_DIR!" && title AG-FRONTEND && npm run dev"
    echo [OK] Frontend started (dev mode).
    popd
) else (
    echo [WARN] Folder frontend_new tidak ditemukan.
)

REM Tunggu frontend siap sebelum buka Chrome
echo [INFO] Menunggu frontend siap (8 detik)...
timeout /t 8 /nobreak >nul

REM ============================================================
REM 5. CHROME + EXTENSION
REM ============================================================
:chrome
echo.
echo [5/5] Membuka Chrome + Extension (CDP :9222)...

REM Cari Chrome di berbagai lokasi
set "CHROME_EXE="
if defined CHROME_PATH (
    if exist "%CHROME_PATH%" set "CHROME_EXE=%CHROME_PATH%"
)
if not defined CHROME_EXE (
    if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
        set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
    )
)
if not defined CHROME_EXE (
    if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
        set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    )
)

set "EXT_PATH=%ROOT%extension_desktop"
set "USER_DATA=%ROOT%userdata"
set "FRONTEND_URL=http://localhost:3000"

if defined CHROME_EXE (
    echo [INFO] Chrome: "!CHROME_EXE!"
    start "" "!CHROME_EXE!" ^
        --load-extension="%EXT_PATH%" ^
        --user-data-dir="%USER_DATA%" ^
        --remote-debugging-port=9222 ^
        --no-first-run ^
        "%FRONTEND_URL%"
    echo [OK] Chrome launched.
) else (
    echo [WARN] Chrome tidak ditemukan. Buka %FRONTEND_URL% secara manual.
)

echo.
echo  ======================================================
echo    SEMUA SERVICES TELAH DIMULAI
echo  ======================================================
echo    Backend  : http://localhost:3001
echo    Frontend : http://localhost:3000
echo    Chrome   : CDP port 9222
echo  ======================================================
echo.
pause
ENDLOCAL
