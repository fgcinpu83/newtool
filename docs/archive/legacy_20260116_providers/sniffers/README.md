# 📁 SNIFFERS - Arbitrage System

Folder ini berisi semua script sniffer untuk menangkap data odds dari berbagai provider.
**Semua sniffer menggunakan manual injection via browser console.**

---

## 📊 STRUKTUR FOLDER

```
sniffers/
├── README.md                     # Dokumentasi
│
├── ACCOUNT_A/                    # Panel Account A (Primary)
│   │                             # Whitelabel: MPO1221
│   │
│   ├── AFB88_sniffer.js          # Provider AFB88
│   └── BTI/                      # Provider BTI
│       ├── bootstrap.js
│       ├── sniffer/
│       ├── normalizer/
│       └── mapper/
│
└── ACCOUNT_B/                    # Panel Account B (Secondary)
    │                             # Whitelabel: QQ188
    │
    ├── CMD368_sniffer.js         # Provider CMD Sport (orange HUD)
    └── ISPORT_sniffer.js         # Provider ISPORT (pink HUD)
```

---

## 🔌 PROVIDER & CARA INJECT

### Account A (MPO1221)

| Provider | File | Cara Inject |
|----------|------|-------------|
| **AFB88** | `ACCOUNT_A/AFB88_sniffer.js` | Copy-paste ke Console browser |
| **BTI** | `ACCOUNT_A/BTI/bootstrap.js` | Copy-paste ke Console browser |

### Account B (QQ188 / MYLV)

| Provider | File | Cara Inject |
|----------|------|-------------|
| **CMD368** | `ACCOUNT_B/CMD368_sniffer.js` | Copy-paste ke Console browser |
| **ISPORT** | `ACCOUNT_B/ISPORT_sniffer.js` | Copy-paste ke Console (frame: sportsFrame) |

⚠️ **PENTING**: 
- Untuk ISPORT, pilih frame "sportsFrame (Sports/)" di console dropdown
- Browser extension tidak diperlukan lagi - semua pakai manual inject

---

## 📋 CARA PAKAI

### Langkah-langkah:

```
1. Buka website provider (login dulu)
2. Tekan F12 → Tab Console
3. Untuk ISPORT: Pilih frame "sportsFrame (Sports/)" dari dropdown
4. Copy seluruh isi file sniffer yang sesuai
5. Paste di console → Enter
6. Lihat HUD muncul di pojok kanan atas
7. Navigasi ke menu Soccer/Football untuk trigger data
8. Monitor console untuk log data
```

### Urutan Inject untuk Account B:

```
1. Buka tab CMD Sport (mylv) → Inject CMD368_sniffer.js
2. Buka tab ISPORT (qq188) → Inject ISPORT_sniffer.js (di sportsFrame)
3. Kedua HUD harus muncul: orange (CMD) dan pink (ISPORT)
4. Cek dashboard: 2 lampu hijau di Account B
```

---

## ✅ STATUS INDIKATOR (Dashboard)

| Warna | Status | Arti |
|-------|--------|------|
| 🟢 Hijau | LIVE | Provider aktif, data mengalir |
| 🟡 Kuning | SESSION_BOUND | Tab tertutup, session valid |
| ⚫ Abu | INACTIVE | Belum connect |

---

## 🔧 DEBUG COMMANDS

Setelah inject sniffer, ketik di console:

```javascript
// CMD368 (Account B)
CMD368B.dump()      // Lihat state
CMD368B.odds()      // Lihat odds terakhir
CMD368B.packets()   // Lihat raw packets
CMD368B.test()      // Test koneksi

// ISPORT (Account B)
QQ188B.dump()       // Lihat state
QQ188B.odds()       // Lihat odds terakhir
QQ188B.test()       // Test koneksi
```

---

## 🎨 HUD COLORS

| Provider | Account | HUD Color |
|----------|---------|-----------|
| AFB88 | A | Cyan/Teal |
| BTI | A | - |
| CMD368 | B | Orange 🟠 |
| ISPORT | B | Pink/Purple 🟣 |

---

## 📝 NOTES

- **Tidak perlu browser extension** - semua manual inject
- Semua sniffer mengirim data ke backend port 3001
- Backend harus running sebelum inject sniffer
- Reload halaman = perlu inject ulang

