const fs = require('fs');
const path = require('path');

console.log('================================================');
console.log('       SCRAPER REPAIR TOOL v1.0 (MPO1221)       ');
console.log('================================================');

const ROOT_DIR = __dirname;
const INJECTED_JS = path.join(ROOT_DIR, 'extension_desktop', 'injected.js');

if (!fs.existsSync(INJECTED_JS)) {
    console.log('\x1b[31m%s\x1b[0m', '❌ GAGAL: File extension_desktop/injected.js tidak ditemukan.');
    process.exit(1);
}

// 1. BACKUP (Safety First)
const backupPath = INJECTED_JS + '.bak';
fs.copyFileSync(INJECTED_JS, backupPath);
console.log(`[BACKUP] Berhasil: injected.js -> .bak`);

// 2. LOAD SOURCE
let content = fs.readFileSync(INJECTED_JS, 'utf8');

// 3. REPLACEMENT 1: Strategy 2 (AFB88/MPO Specific)
const oldStrategy2 = /\/\/ Strategy 2: AFB88 SPECIFIC \(Specific Class Selectors\)[\s\S]*?\}\);/g;
const newStrategy2 = `        // Strategy 2: ROBUST TABLE/GRID ITERATOR (MPO1221 FIX)
        // Kita mencari elemen baris (TR atau DIV row) dan mengekstrak data secara posisi
        document.querySelectorAll('table tr, div.row, div[class*="match-row"], div[class*="event-item"]').forEach(container => {
            const teams = extractTeamNamesFromRow(container);
            
            // Cari angka yang formatnya seperti odds (misal: 1.85 atau -0.95)
            const rowOdds = [];
            const textNodes = container.innerText.split(/\\s+|\\n+/);
            textNodes.forEach(txt => {
                if (txt.match(/^[+\\-]?[012]\\.\\d{2}$/)) {
                    rowOdds.push(txt);
                }
            });

            if (teams.home && teams.away && rowOdds.length >= 2) {
                extractedMatches.push({
                    home: teams.home,
                    away: teams.away,
                    source: 'ROBUST_TABLE_ITERATOR',
                    odds: rowOdds.slice(0, 6) // Ambil odds utama
                });
            }
        });`;

// 4. REPLACEMENT 2: extractTeamNamesFromRow
const oldExtractFunc = /function extractTeamNamesFromRow\(row\) \{[\s\S]*?return \{ home, away \};\s*\}/g;
const newExtractFunc = `function extractTeamNamesFromRow(row) {
        // Cari semua span/div/td yang berisi teks nama tim
        const potentialElements = Array.from(row.querySelectorAll('td, span, div, b, strong'));
        let home = '', away = '';

        for (const el of potentialElements) {
            const text = (el.textContent || "").trim();
            
            // Filter: Bukan angka, panjang 3-40 karakter, bukan label 'Live'
            if (!text || text.length < 3 || text.length > 40) continue;
            if (text.match(/[0-9]/)) continue; // Abaikan jika ada angka (odds/skor)
            if (['LIVE', 'TODAY', 'SOCCER', 'FOOTBALL'].includes(text.toUpperCase())) continue;

            if (!home) {
                home = sanitizeTeamName(text);
            } else if (!away && text !== home) {
                away = sanitizeTeamName(text);
                break;
            }
        }
        return { home, away };
    }`;

// Eksekusi Patcher
let patchedCount = 0;
if (content.match(oldStrategy2)) {
    content = content.replace(oldStrategy2, newStrategy2);
    patchedCount++;
}
if (content.match(oldExtractFunc)) {
    content = content.replace(oldExtractFunc, newExtractFunc);
    patchedCount++;
}

if (patchedCount > 0) {
    fs.writeFileSync(INJECTED_JS, content, 'utf8');
    console.log(`\x1b[32m%s\x1b[0m`, `[PATCH] Berhasil memperbarui ${patchedCount} blok kode di injected.js.`);
    console.log('\n✅ PERBAIKAN SELESAI.');
    console.log('AKSI: Silakan REFRESH halaman browser MPO1221 Anda agar scraper baru aktif.');
} else {
    console.log('\x1b[33m%s\x1b[0m', '⚠️ PERINGATAN: Blok kode tidak ditemukan. Mungkin sudah diperbarui?');
}