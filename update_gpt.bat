@echo off
echo [INFO] Memulai sinkronisasi kode dari GitHub ke E:\newtool...
E:
cd "E:\newtool"

echo [1/3] Mengambil data terbaru dari GitHub...
git fetch --all

echo [2/3] Menimpa folder lokal (Force Reset)...
git reset --hard origin/autodebug/20260205-210532-attempt-1

echo [3/3] Membersihkan file sampah (Kecuali file .bat)...
:: Menghapus file sampah tapi melindungi semua file .bat agar tidak hilang
git clean -fd -e *.bat

echo.
echo [BERHASIL] Folder E:\newtool sudah sinkron dan skrip tetap aman.
pause