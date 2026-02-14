# 🔧 NETWORK FIX FINAL: EMULATOR → INTERNET → HOST → BACKEND

**Tanggal Audit:** 2026-01-12  
**Status:** ROOT CAUSE IDENTIFIED + FIX PROVIDED

---

## 📊 ROOT CAUSE REPORT

### Temuan Utama

| Layer | Status | Bukti |
|-------|--------|-------|
| Network (IP/Routing) | ✅ OK | `ping 8.8.8.8` sukses |
| DNS | ✅ OK | `nslookup google.com` resolved |
| HTTPS/TLS | ✅ OK | `curl https://google.com` → HTTP 200 |
| Proxy | ✅ BERSIH | `http_proxy=null` |
| HTTP Toolkit | ✅ TIDAK ADA | Tidak terinstall |

### Kesimpulan

**Network layer emulator BUKAN masalah.**  
Jika browser masih `ERR_TIMED_OUT`, penyebabnya adalah:

1. **Browser data corrupt** → Clear cache/data
2. **Kiwi Browser belum terinstall** → Perlu install ulang
3. **WebView conflict** → Update WebView via Play Store

---

## 🛠️ FIX PROCEDURE (SEKALI SAJA)

### STEP 1: Verifikasi Docker/WSL OFF

```powershell
# Run di PowerShell (Admin)
Get-Service -Name "*docker*", "*wsl*" | Where-Object Status -eq "Running" | Stop-Service -Force
```

**Hasil yang diharapkan:** Tidak ada Docker/WSL running saat pakai LDPlayer.

---

### STEP 2: Install Kiwi Browser

1. Buka **LDPlayer**
2. Buka **Play Store** (atau download APK manual)
3. Search: **"Kiwi Browser"**
4. Install → Open
5. Accept permissions

**Alternatif (APK):**
```powershell
# Download Kiwi APK dan install via ADB
adb -s emulator-5554 install kiwibrowser.apk
```

---

### STEP 3: Clear Semua Browser Data

Jalankan script ini dari host:

```powershell
# Clear Chrome
adb -s emulator-5554 shell pm clear com.android.chrome

# Clear Kiwi (jika ada)
adb -s emulator-5554 shell pm clear com.kiwibrowser.browser 2>$null

# Reset proxy settings (preventif)
adb -s emulator-5554 shell settings delete global http_proxy
adb -s emulator-5554 shell settings delete global global_http_proxy_host
adb -s emulator-5554 shell settings delete global global_http_proxy_port
```

---

### STEP 4: Verifikasi Internet Emulator

```powershell
# Test dari command line
adb -s emulator-5554 shell ping -c 3 8.8.8.8
adb -s emulator-5554 shell curl -I https://www.google.com
```

**Hasil yang diharapkan:**
- Ping: 0% packet loss
- Curl: HTTP/1.1 200 OK

---

### STEP 5: Test Browser

```powershell
# Buka browser otomatis ke google.com
adb -s emulator-5554 shell am start -a android.intent.action.VIEW -d "https://www.google.com"
```

**Hasil yang diharapkan:** Browser terbuka dan Google.com tampil.

---

## 📐 ARSITEKTUR KOMUNIKASI FINAL

```
┌─────────────────────────────────────────────────────────────────┐
│                        LDPlayer (Android)                        │
│  ┌─────────────┐    ┌─────────────────────────────────┐         │
│  │   Browser   │    │  AG Bridge Extension (Socket)  │         │
│  │  (Kiwi/     │    │  connects to localhost:3001    │         │
│  │   Chrome)   │    └───────────────┬─────────────────┘         │
│  └──────┬──────┘                    │                           │
│         │                           │                           │
│    [NAT Network]               [ADB Reverse]                    │
│         │                      tcp:3001→tcp:3001                │
└─────────┼───────────────────────────┼───────────────────────────┘
          │                           │
          ▼                           ▼
    ┌──────────┐              ┌──────────────────┐
    │ INTERNET │              │    Host PC       │
    │ google.  │              │  ┌────────────┐  │
    │ com,     │              │  │  Backend   │  │
    │ provider │              │  │  :3001     │  │
    │ sites    │              │  └────────────┘  │
    └──────────┘              └──────────────────┘
```

### Port Binding

| Komponen | Port | Metode |
|----------|------|--------|
| Backend (NestJS) | 3001 | Socket.IO + REST |
| Frontend (Next.js) | 3000 | HTTP |
| Redis | 6379 | Native Windows |
| Emulator → Host | 3001 | ADB Reverse Tunnel |

### Metode Routing

| Path | Metode |
|------|--------|
| Emulator → Internet | NAT (LDPlayer built-in) |
| Emulator → Host Backend | ADB Reverse (`localhost:3001` → `host:3001`) |
| Extension → Backend | Socket.IO via ADB tunnel |

---

## ✅ DEFINISI SUKSES

Sistem dianggap **SELESAI SETUP** jika:

- [ ] Chrome/Kiwi di emulator bisa buka `google.com`
- [ ] Chrome/Kiwi di emulator bisa buka provider site
- [ ] Extension AG Bridge connected (check backend log)
- [ ] Backend menerima session data dari emulator

---

## 🚫 LARANGAN USER

Setelah setup selesai, user **TIDAK BOLEH**:

- ❌ Set proxy manual di emulator
- ❌ Install HTTP Toolkit / VPN di emulator
- ❌ Mengubah network mode LDPlayer
- ❌ Enable Docker/WSL saat pakai emulator
- ❌ Debug jaringan secara manual

---

## 📋 SOP HARIAN (POST-SETUP)

### 1. Startup Sistem

Jalankan `ORCHESTRATOR_MASTER.bat`:
- ✅ Redis starts
- ✅ ADB tunnel established
- ✅ Backend starts
- ✅ Frontend starts

### 2. Di Emulator (User Task)

| Step | Aksi |
|------|------|
| 1 | Buka LDPlayer |
| 2 | Buka Kiwi Browser |
| 3 | Login ke provider |
| 4 | Masuk halaman Sports/Live |

### 3. Selesai

Sistem otomatis detect session dan mulai harvesting.

---

## 🔄 RECOVERY (Jika Error)

### Browser tidak bisa internet

```powershell
# Step 1: Test network
adb -s emulator-5554 shell ping -c 3 8.8.8.8

# Jika ping GAGAL → Network issue (cek LDPlayer settings)
# Jika ping SUKSES → Browser issue (clear data):
adb -s emulator-5554 shell pm clear com.android.chrome
adb -s emulator-5554 shell pm clear com.kiwibrowser.browser
```

### ADB tidak detect emulator

```powershell
# Restart ADB
adb kill-server
adb start-server
adb devices
```

### Backend tidak menerima data

```powershell
# Re-establish tunnel
adb -s emulator-5554 reverse --remove-all
adb -s emulator-5554 reverse tcp:3001 tcp:3001
adb -s emulator-5554 reverse --list
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-12
