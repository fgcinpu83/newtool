# SOP: Setup Project Tanpa Konflik Docker & Emulator (LDPlayer)

Dokumen ini menjelaskan cara menjalankan Project Arbitrage menggunakan **Redis Native (Windows)**, sehingga Anda **TIDAK PERLU** menyalakan Docker Desktop. Ini akan mencegah konflik "Blue Screen" atau crash pada LDPlayer/Emulator.

---

## 🛑 Langkah 1: Matikan Docker Sepenuhnya
Sebelum memulai, pastikan Docker tidak berjalan karena akan memakan port dan bentrok dengan Emulator.
1. Cek System Tray (ikon di pojok kanan bawah taskbar).
2. Klik kanan ikon **Docker Desktop** (gambar paus).
3. Pilih **Quit Docker Desktop**.

---

## 🧹 Langkah 2: Bersihkan Port Redis (Jika Nyangkut)
Terkadang ada sisa proses Redis yang "zombie". Kita harus mematikannya agar yang baru bisa jalan.

**Cara Manual:**
1. Buka **Task Manager** (`Ctrl + Shift + Esc`).
2. Cari tab **"Details"**.
3. Cari `redis-server.exe` atau proses apapun yang menggunakan PID `14788` (atau PID lain jika port 6379 terpakai).
4. Klik kanan -> **End Task**.

**Cara Terminal (Run as Admin):**
```cmd
taskkill /F /IM redis-server.exe
```

---

## 🚀 Langkah 3: Jalankan Redis Native
Kita akan menggunakan Redis yang sudah terinstall di Windows (`C:\Program Files\Redis`).

**Cara Menjalankan (Command Prompt):**
Buka terminal baru (CMD), lalu copy-paste perintah ini:
```cmd
"C:\Program Files\Redis\redis-server.exe"
```
*(Jangan tutup terminal ini selama Anda bekerja)*

Jika berhasil, akan muncul logo Redis (kotak grafis) dan tulisan "Ready to accept connections".

---

## ▶️ Langkah 4: Jalankan Project
Sekarang project aman dijalankan berbarengan dengan LDPlayer.

**A. Jalankan Backend**
1. Buka Terminal di folder `backend`.
2. Jalankan:
   ```bash
   npm run start:dev
   ```

**B. Jalankan Frontend**
1. Buka Terminal di folder `frontend`.
2. Jalankan:
   ```bash
   npm run dev
   ```

---

## 📱 Langkah 5: Jalankan LDPlayer
Setelah langkah di atas selesai, Anda bebas membuka LDPlayer. Tidak akan ada lagi konflik virtualisasi karena Docker sudah mati.

---

**Troubleshooting:**
Jika Backend masih error `ECONNREFUSED 127.0.0.1:6379`:
1. Pastikan Langkah 3 (Jendela Redis) masih terbuka dan tidak ada error.
2. Pastikan tidak ada firewall yang memblokir port 6379.
