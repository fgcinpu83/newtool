const path = require('path');
const fs = require('fs');

// 🛡️ AUTO-RESOLVE NODE_MODULES
const backendModules = path.join(__dirname, 'backend', 'node_modules');
if (fs.existsSync(backendModules)) {
    module.paths.push(backendModules);
}

let WebSocket;
try {
    WebSocket = require('ws');
} catch (e) {
    console.log('\x1b[31m%s\x1b[0m', '❌ ERROR: Library "ws" tidak ditemukan.');
    console.log('Pastikan folder "backend/node_modules" ada.');
    process.exit(1);
}

// CONFIGURATION
const BACKEND_URL = 'ws://localhost:8080';
const MONITOR_DURATION = 10000; // 10 seconds audit

console.log('\x1b[36m%s\x1b[0m', '================================================');
console.log('\x1b[36m%s\x1b[0m', '       ARBITRAGE SYSTEM AUTO-DIAGNOSTIC         ');
console.log('\x1b[36m%s\x1b[0m', '================================================');
console.log('Target: ' + BACKEND_URL);
console.log('Auditing system status for ' + (MONITOR_DURATION / 1000) + 's...\n');

let state = {
    connected: false,
    accA: false,
    accB: false,
    eventsA: 0,
    eventsB: 0,
    pairs: 0,
    latency: [],
    lastStatus: null
};

const ws = new WebSocket(BACKEND_URL);

// Timeout if cannot connect at all
const connectionTimeout = setTimeout(() => {
    if (!state.connected) {
        console.log('\x1b[31m%s\x1b[0m', '[FAILED] ❌ Backend Offline (Checked Port 8080).');
        console.log('Saran: Pastikan backend sudah dijalankan (npm run build && npm run start).');
        process.exit(1);
    }
}, 3000);

ws.on('open', () => {
    state.connected = true;
    clearTimeout(connectionTimeout);
    console.log('\x1b[32m%s\x1b[0m', '[PASSED] ✅ Koneksi Backend Stabil.');
});

ws.on('message', (msg) => {
    try {
        const payload = JSON.parse(msg);
        const { event, data } = payload;

        if (event === 'system_status') {
            state.accA = data.accountA_active;
            state.accB = data.accountB_active;
            state.lastStatus = data;
        }

        if (event === 'active_events' || event === 'active_pairs') {
            state.eventsA = data.A || state.eventsA;
            state.eventsB = data.B || state.eventsB;
            state.pairs = data.pairs || state.pairs;
        }

        if (event === 'scanner:update_batch') {
            if (data && data.length > 0 && data[0].lastUpdate) {
                state.latency.push(Date.now() - data[0].lastUpdate);
                if (state.latency.length > 10) state.latency.shift();
            }
        }
    } catch (e) { }
});

ws.on('error', (err) => { });

// Final Report Generation
setTimeout(() => {
    console.log('\x1b[33m%s\x1b[0m', '----------- FINAL AUDIT REPORT -----------');

    // 1. Account A (AFB88)
    if (state.accA) {
        if (state.eventsA > 0) {
            console.log('\x1b[32m%s\x1b[0m', '[PASSED] ✅ Data AFB88 (Acc A) Terdeteksi: ' + state.eventsA + ' events.');
        } else {
            console.log('\x1b[31m%s\x1b[0m', '[FAILED] ❌ Data AFB88 Kosong. (Browser A mungkin belum login/stuck).');
        }
    } else {
        console.log('\x1b[34m%s\x1b[0m', '[INFO] ℹ️ Account A Di-disable oleh User.');
    }

    // 2. Account B (ISPORT)
    if (state.accB) {
        if (state.eventsB > 0) {
            console.log('\x1b[32m%s\x1b[0m', '[PASSED] ✅ Data ISPORT (Acc B) Terdeteksi: ' + state.eventsB + ' events.');
        } else {
            console.log('\x1b[31m%s\x1b[0m', '[FAILED] ❌ Data ISPORT Kosong / Timeout. (Cek Koneksi SABA).');
        }
    } else {
        console.log('\x1b[34m%s\x1b[0m', '[INFO] ℹ️ Account B Di-disable oleh User.');
    }

    // 3. Pairing / Arbitrage
    if (state.pairs > 0) {
        console.log('\x1b[32m%s\x1b[0m', '[PASSED] ✅ Pairing Engine Aktif: ' + state.pairs + ' pairs match ditemukan.');
    } else if (state.eventsA > 0 && state.eventsB > 0) {
        console.log('\x1b[31m%s\x1b[0m', '[FAILED] ❌ Tidak ada Pair ditemukan padahal data A & B masuk. (Potensi Botch di Pairing Engine).');
    } else {
        console.log('\x1b[34m%s\x1b[0m', '[INFO] ℹ️ Menunggu data lengkap untuk Pairing.');
    }

    // 4. Latency
    if (state.latency.length > 0) {
        const avg = state.latency.reduce((a, b) => a + b, 0) / state.latency.length;
        console.log('\x1b[34m%s\x1b[0m', '[INFO] ℹ️ Rata-rata Latency: ' + Math.round(avg) + 'ms.');
    }

    console.log('\x1b[33m%s\x1b[0m', '-------------------------------------------');
    console.log('Audit Selesai.');
    ws.close();
    process.exit(0);
}, MONITOR_DURATION);
