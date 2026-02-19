/**
 * 🚀 EMERGENCY KICKSTART v3.5
 * Forces ACTIVATE_MARKET_AUTO and status broadcast
 * Run with: npx ts-node kickstart_v35.ts
 */

import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3001';

async function kickstart() {
    console.log('🚀 [KICKSTART v3.5] Connecting to backend...');

    const socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000
    });

    socket.on('connect', () => {
        console.log('✅ [KICKSTART] Connected to backend:', socket.id);

        // 1. Force GET_STATUS to trigger broadcastStatus
        console.log('📡 [KICKSTART] Sending GET_STATUS...');
        socket.emit('command', { type: 'GET_STATUS' });

        // 2. Force ACTIVATE_MARKET_AUTO for Account A
        console.log('📡 [KICKSTART] Sending ACTIVATE_MARKET_AUTO for Account A...');
        socket.emit('browser:command', {
            account: 'A',
            command: 'ACTIVATE_MARKET_AUTO',
            provider: 'AFB88'
        });

        // 3. Force ACTIVATE_MARKET_AUTO for Account B
        console.log('📡 [KICKSTART] Sending ACTIVATE_MARKET_AUTO for Account B...');
        socket.emit('browser:command', {
            account: 'B',
            command: 'ACTIVATE_MARKET_AUTO',
            provider: 'ISPORT'
        });

        // 4. Toggle accounts to force activity
        setTimeout(() => {
            console.log('📡 [KICKSTART] Force toggling Account A ON...');
            socket.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: 'A', active: true } });
        }, 1000);

        setTimeout(() => {
            console.log('📡 [KICKSTART] Force toggling Account B ON...');
            socket.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: 'B', active: true } });
        }, 2000);

        // Close after 5 seconds
        setTimeout(() => {
            console.log('✅ [KICKSTART] Complete! Closing connection...');
            socket.close();
            process.exit(0);
        }, 5000);
    });

    socket.on('system_status', (data) => {
        console.log('📥 [KICKSTART] Received system_status:', JSON.stringify(data, null, 2));
    });

    socket.on('pong', (ts) => {
        console.log('🏓 [KICKSTART] Pong received, latency:', Date.now() - ts, 'ms');
    });

    socket.on('connect_error', (err) => {
        console.error('❌ [KICKSTART] Connection error:', err.message);
        process.exit(1);
    });

    socket.on('disconnect', (reason) => {
        console.log('🔌 [KICKSTART] Disconnected:', reason);
    });

    // Emit client_ping to test connection (must include account)
    setTimeout(() => {
        const account = 'A';
        if (!account) {
            console.warn('client_ping blocked: account missing');
            return;
        }
        socket.emit('client_ping', { ts: Date.now(), account });
    }, 500);
}

kickstart().catch(console.error);
