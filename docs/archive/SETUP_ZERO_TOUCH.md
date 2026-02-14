# 🚀 ZERO TOUCH SETUP (SATU KALI SEUMUR HIDUP)

Dokumen ini adalah **SETUP FINAL** untuk arsitektur komunikasi Emulator ↔ Host ↔ Backend.

Setelah setup ini selesai, user hanya perlu: **Buka emulator → Login → Buka sports → Sistem hidup.**

---

## 🔧 PRASYARAT SISTEM

### A. Host PC
- ✅ Windows 10/11
- ✅ LDPlayer 9 terinstall
- ✅ Node.js terinstall
- ✅ Redis Native terinstall (`C:\Program Files\Redis\`)
- ✅ ADB tersedia di PATH

### B. LDPlayer
- ✅ Network Mode: **NAT** (default, jangan ubah)
- ✅ Network Bridging: **OFF**
- ❌ **TIDAK BOLEH** ada HTTP Toolkit / VPN terinstall di emulator

---

## 🛠️ LANGKAH SETUP (SEKALI SAJA)

### STEP 1: Bersihkan HTTP Toolkit (Jika Ada)

Jika sebelumnya pernah pakai HTTP Toolkit, WAJIB di-uninstall:

```powershell
# Dari PowerShell host
adb -s emulator-5554 shell pm uninstall tech.httptoolkit.android.v1
adb -s emulator-5554 shell settings delete global http_proxy
adb -s emulator-5554 shell settings delete global global_http_proxy_host
adb -s emulator-5554 shell settings delete global global_http_proxy_port
```

### STEP 2: Install Kiwi Browser

1. Buka **Play Store** di LDPlayer
2. Cari dan install **"Kiwi Browser"**
3. Jadikan default browser (opsional)

### STEP 3: Pasang AG Bridge Extension

1. Copy folder `providers\sniffers\ACCOUNT_B\extension_bridge\` ke emulator
   - Drag & drop ke layar LDPlayer → masuk ke `/sdcard/Download/`

2. Buka **Kiwi Browser**

3. Ketik: `chrome://extensions`

4. Aktifkan **Developer Mode** (pojok kanan atas)

5. Klik **"+(from .zip/.crx/.user.js)"** atau **"Load unpacked"**

6. Pilih folder extension yang sudah di-copy

7. Extension "Antigravity Bridge" akan muncul aktif

### STEP 4: Buat Script Startup

(LEGACY) `START_SYSTEM.bat` removed. Use `ORCHESTRATOR_MASTER.bat` in the repository root to start the full system.

```batch
@echo off
echo ============================================
echo   ANTIGRAVITY ARBITRAGE ENGINE STARTUP
echo ============================================
echo.

echo [1/4] Starting Redis...
start "Redis" "C:\Program Files\Redis\redis-server.exe"
timeout /t 2 > nul

echo [2/4] Setting up ADB Tunnel...
adb -s emulator-5554 reverse tcp:3001 tcp:3001
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Is LDPlayer running?
    pause
    exit /b 1
)

echo [3/4] Starting Backend...
start "Backend" cmd /c "cd /d e:\newtool\backend && node dist\src\main.js"
timeout /t 5 > nul

echo [4/4] Starting Frontend...
start "Frontend" cmd /c "cd /d e:\new tools\frontend && npm run dev"

echo.
echo ============================================
echo   SYSTEM READY!
echo ============================================
echo.
echo Next steps:
echo 1. Open Kiwi Browser in LDPlayer
echo 2. Login to provider (CMD/SBO/etc)
echo 3. Go to Sports / Live page
echo 4. Wait 10 seconds - system activates automatically
echo.
pause
```

---

## 📋 SOP HARIAN (SETELAH SETUP)

### A. Di Host PC (Sekali di Awal Hari):
Double-click **`ORCHESTRATOR_MASTER.bat`** → Biarkan jalan sampai selesai

### B. Di Emulator (4 Langkah Saja):

| Step | Aksi |
|------|------|
| 1 | Buka **LDPlayer** |
| 2 | Buka **Kiwi Browser** |
| 3 | **Login** ke provider |
| 4 | Masuk halaman **Sports / Live** |

**SELESAI.** Tunggu 10 detik, sistem aktif otomatis.

### Yang User TIDAK Perlu Lakukan:
- ❌ Menjalankan script di emulator
- ❌ Set IP manual
- ❌ Test URL
- ❌ Debug port
- ❌ Inject script
- ❌ Buka console

---

## ✅ VERIFIKASI SUKSES

### Indikator di UI Dashboard:
- 🟢 Lampu provider: **GREEN** atau **YELLOW**
- 📊 Raw msg/min: **> 0**
- 🔗 Active Pairs: menunjukkan angka

### Log Backend (opsional lihat):
```
[SESSION-GATEWAY] 🍪 RECEIVED SESSION from B (CMD360)
[INGEST-GATEWAY] account=B provider=CMD type=odds_batch packets=XX
```

---

## �️ TROUBLESHOOTING

### Browser tidak bisa internet (ERR_TIMED_OUT)

**Penyebab:** HTTP Toolkit / VPN masih terinstall

**Solusi:**
```powershell
adb -s emulator-5554 shell pm list packages | findstr toolkit
# Jika ada output, uninstall:
adb -s emulator-5554 shell pm uninstall tech.httptoolkit.android.v1
```

### Extension tidak connect

**Penyebab:** ADB tunnel tidak aktif

**Solusi:**
```powershell
adb -s emulator-5554 reverse tcp:3001 tcp:3001
adb -s emulator-5554 reverse --list
# Harus muncul: tcp:3001 tcp:3001
```

### Backend tidak merespon

**Penyebab:** Backend belum running atau crash

**Solusi:**
```powershell
cd e:\newtool\backend
node dist\src\main.js
```

---

## 📐 ARSITEKTUR KOMUNIKASI

```
LDPlayer (Android)
    └── Kiwi Browser
        └── AG Bridge Extension
            └── Socket.IO → localhost:3001
                    │
                    │ (ADB REVERSE TUNNEL)
                    ▼
Host PC (Windows)
    └── Backend (NestJS :3001)
        └── WebSocket Gateway
            └── Session Manager → Worker → Arbitrage
```

**Metode Binding:** ADB Reverse Tunnel (stabil, auto-setup via script)

---

## ⚙️ STATUS TEKNIS

| Komponen | Port | Metode |
|----------|------|--------|
| Backend | 3001 | NestJS + Socket.IO |
| Frontend | 3000 | Next.js |
| Redis | 6379 | Native Windows |
| Emulator → Host | 3001 | ADB Reverse |

**Extension:** Socket.IO ke `localhost:3001` (terlewati ADB tunnel)

---

**Last Updated:** 2026-01-12
**Version:** 2.0 (Zero Touch Final)
