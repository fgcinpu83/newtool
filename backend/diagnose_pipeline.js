/**
 * PIPELINE DIAGNOSTIC SCRIPT (v5.3 - PURE WEBSOCKET)
 * Run this script to verify data flow from extension to backend
 * Usage: node diagnose_pipeline.js
 */

const WebSocket = require('ws');

console.log('\x1b[36m%s\x1b[0m', '🔍 PIPELINE DIAGNOSTIC v5.3 (Bridge Protocol)');
console.log('===============================================\n');

const WS_URL = 'ws://localhost:8080';
let socket;

try {
    socket = new WebSocket(WS_URL);
} catch (e) {
    console.error('❌ Failed to create WebSocket:', e.message);
    process.exit(1);
}

let lastEventsA = 0;
let lastEventsB = 0;
let packetsReceived = 0;

socket.on('open', () => {
    console.log('\x1b[32m%s\x1b[0m', '✅ Connected to Gateway (8080)');
    console.log('   Waiting for traffic...\n');

    // Request initial status
    socket.send(JSON.stringify({ event: 'command', data: { type: 'GET_STATUS' } }));
});

socket.on('message', (raw) => {
    try {
        const { event, data } = JSON.parse(raw);
        packetsReceived++;

        if (event === 'system_status') {
            console.log('\n📊 SYSTEM STATUS:');
            console.log(`   Account A: ${data.accountA_active ? '🟢' : '⚪'} Balance: ${data.balanceA}`);
            console.log(`   Account B: ${data.accountB_active ? '🟢' : '⚪'} Balance: ${data.balanceB}`);
        }

        else if (event === 'active_events') {
            const dA = data.A - lastEventsA;
            const dB = data.B - lastEventsB;
            lastEventsA = data.A;
            lastEventsB = data.B;

            console.log(`📈 [${new Date().toLocaleTimeString()}] Events A: ${data.A} (${dA >= 0 ? '+' : ''}${dA}) | B: ${data.B} (${dB >= 0 ? '+' : ''}${dB}) | Pairs: ${data.pairs || 0}`);

            if (data.B === 0 && packetsReceived > 5) {
                console.log('   ⚠️  Registry B is EMPTY. Hint: Refresh SABA/ISPORT tab and click "Soccer"');
            }
        }

        else if (event === 'scanner:update' || event === 'scanner:update_batch') {
            console.log('\x1b[35m%s\x1b[0m', `🌊 SCANNER HIT: Match found! (Profit: ${Array.isArray(data) ? data[0]?.profit : data?.profit}%)`);
        }

        else if (event === 'system_log') {
            console.log(`📝 [LOG] ${data.message}`);
        }

    } catch (e) {
        // Skip non-json or malformed
    }
});

socket.on('error', (err) => {
    console.log('\x1b[31m%s\x1b[0m', '❌ Socket Error:', err.message);
    if (err.message.includes('ECONNREFUSED')) {
        console.log('   HINT: Is the Backend running? (npm run dev)');
    }
});

socket.on('close', () => {
    console.log('\n🔌 Connection closed. Restarting diagnostic in 5s...');
    setTimeout(() => { process.exit(0); }, 5000);
});

// Heartbeat
setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
        console.log(`⏱️  [ALIVE] Packets processed: ${packetsReceived}`);
    }
}, 30000);
