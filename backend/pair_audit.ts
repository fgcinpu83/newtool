/**
 * 🔍 PAIR AUDIT SCRIPT v1.0
 * Shows what's in registryA and registryB
 */

import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3001';

async function audit() {
    console.log('\n🔍 PAIR AUDIT');
    console.log('========================================\n');

    const socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        timeout: 5000
    });

    socket.on('connect', () => {
        console.log('✅ Connected to backend');

        // Request detailed discovery stats
        socket.emit('command', { type: 'GET_DISCOVERY_STATS' });
        socket.emit('command', { type: 'GET_STATUS' });
    });

    socket.on('system_status', (data) => {
        console.log(`\n📊 STATUS:`);
        console.log(`  Events A: ${data.activeEventsA}`);
        console.log(`  Events B: ${data.activeEventsB}`);
        console.log(`  Pairs: ${data.activePairs}`);
    });

    socket.on('discovery_stats', (data) => {
        console.log('\n📋 DISCOVERY STATS:');
        console.log(JSON.stringify(data, null, 2));
    });

    // Wait 5 seconds for data
    await new Promise(resolve => setTimeout(resolve, 5000));

    socket.close();
    process.exit(0);
}

audit().catch(console.error);
