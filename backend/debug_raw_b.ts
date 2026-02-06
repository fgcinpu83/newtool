/**
 * 🔍 RAW B PAYLOAD DEBUGGER v1.0
 * Captures and displays raw payload structure from Account B
 */

import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3001';

async function debug() {
    console.log('\n🔍 RAW B PAYLOAD DEBUGGER');
    console.log('========================================');
    console.log('Listening for 60 seconds...\n');

    const socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        timeout: 5000
    });

    let matchCount = 0;
    let seenKeys = new Set<string>();
    let payloadSamples: any[] = [];

    socket.on('connect', () => {
        console.log('✅ Connected to backend');

        // Request status
        socket.emit('command', { type: 'GET_STATUS' });
        socket.emit('command', { type: 'ACTIVATE_MARKET_AUTO', account: 'B' });
    });

    socket.on('system_status', (data) => {
        console.log(`📊 Events A: ${data.activeEventsA} | Events B: ${data.activeEventsB} | Pairs: ${data.activePairs}`);
    });

    socket.on('active_events', (data) => {
        console.log(`📈 Active Events Update: A=${data.A} B=${data.B} Pairs=${data.pairs}`);
        if (data.B > 0) {
            matchCount = data.B;
        }
    });

    // Listen for raw debug packets
    socket.on('debug:raw_b', (data) => {
        console.log('\n🔴 RAW B DATA RECEIVED:');
        console.log('Keys:', Object.keys(data).join(', '));
        console.log('Sample:', JSON.stringify(data).substring(0, 500));

        // Store keys for analysis
        Object.keys(data).forEach(k => seenKeys.add(k));
    });

    // Listen for any scanner updates
    socket.on('scanner:update', (pair) => {
        console.log('\n🎯 PAIR DETECTED:', pair.legA?.home, 'vs', pair.legB?.home);
    });

    // Wait 60 seconds
    await new Promise(resolve => setTimeout(resolve, 60000));

    console.log('\n========================================');
    console.log('SUMMARY:');
    console.log('========================================');
    console.log('Total unique keys seen:', seenKeys.size);
    console.log('Keys:', Array.from(seenKeys).join(', '));
    console.log('Final Event B count:', matchCount);
    console.log('========================================');

    socket.close();
    process.exit(0);
}

debug().catch(console.error);
