# 📋 SOP OPERASIONAL HARIAN - ANTIGRAVITY v3.0 DESKTOP

**Versi:** 3.0.0 DESKTOP EDITION  
**Tanggal:** 13 Januari 2026  
**Mode:** Desktop Browser Only (No Emulator)

---

## ⏰ STARTUP HARIAN (5 Langkah)

```
┌─────────────────────────────────────────────────────────────┐
│  SETIAP HARI - LAKUKAN INI                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1️⃣  Start Redis: "C:\Program Files\Redis\redis-server.exe"│
│      (Biarkan terminal ini tetap terbuka)                   │
│                                                             │
│  2️⃣  Klik dua kali: START_SYSTEM.bat                       │
│      → Tunggu sampai muncul "SYSTEM READY!"                 │
│                                                             │
│  3️⃣  Buka Chrome → http://localhost:3000                   │
│      → Dashboard Antigravity akan muncul                    │
│                                                             │
│  4️⃣  Di Dashboard:                                         │
│      → Masukkan URL provider (misal: qq188.com)             │
│      → Klik toggle ON untuk akun yang diinginkan            │
│      → Browser tab baru akan terbuka otomatis               │
│                                                             │
│  5️⃣  Di tab yang baru terbuka:                             │
│      → Login dengan akun Anda                               │
│      → Masuk ke menu Sports                                 │
│      → Lampu provider di dashboard akan HIJAU               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 SETUP PERTAMA KALI (Sekali Saja)

```
┌─────────────────────────────────────────────────────────────┐
│  PEMBERSIHAN DOCKER (WAJIB)                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1️⃣  Quit Docker Desktop sepenuhnya dari System Tray.       │
│                                                             │
│  2️⃣  Pastikan tidak ada proses redis-server.exe yang        │
│      nyangkut di Task Manager.                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│  SETUP EXTENSION                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1️⃣  Buka Chrome                                            │
│  2️⃣  Ketik: chrome://extensions                             │
│  3️⃣  Aktifkan "Developer mode"                             │
│  4️⃣  Klik "Load unpacked"                                  │
│  5️⃣  Pilih folder: e:\new tools\extension_desktop          │
│  6️⃣  Pastikan status: "Connected to Backend"               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ KONDISI SUKSES

| Indikator | Status OK |
|-----------|-----------|
| Extension popup | "Connected to Backend" |
| Dashboard | Provider lamp HIJAU |
| HUD di halaman provider | 🛰️ AG (hijau) |
| Backend console | `[SESSION] captured` |

---

## 🔄 TOGGLE BEHAVIOR (v3.1)

1.  **Toggle ON**: Backend mengirim command → Chrome buka tab baru → Extension detect & capture session → Worker lahir secara pasif.
2.  **Toggle OFF**: Backend mengirim command → Extension menutup tab → Worker mati & session di-clear.

---

## ⚠️ TROUBLESHOOTING

| Masalah | Solusi |
|---------|--------|
| Lampu Kuning Saja | Klik market/league di sportsbook (Activator Trigger). |
| ECONNREFUSED 6379 | Pastikan terminal Redis Native (Langkah 1) masih jalan. |
| Lampu tetap Grey | Refresh halaman provider atau Toggle OFF-ON. |
| Extension "Disconnected"| Pastikan backend running + reload extension. |

---

## ⛔ YANG TIDAK BOLEH DILAKUKAN

- ❌ Jangan nyalakan Docker Desktop (Conflict Port 6379).
- ❌ Jangan buka F12/Developer Tools pada tab Sportsbook.
- ❌ Jangan disable extension "Antigravity Desktop Bridge".
- ❌ Jangan close browser utama saat sistem sedang pairing.

---

## 📁 STRUKTUR FILE

```
e:\new tools\
├── START_SYSTEM.bat          # Startup harian
├── extension_desktop\        # Chrome extension
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   └── popup.js
├── backend\                  # Backend server
└── frontend\                 # UI Dashboard
```
