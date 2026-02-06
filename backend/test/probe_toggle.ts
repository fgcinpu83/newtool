import { io } from 'socket.io-client';
import * as fs from 'fs';

const socket = io('http://localhost:3001', { transports: ['websocket'] });

console.log('--- TOGGLE PROBE STARTING ---');

socket.on('connect', () => {
    console.log('Connected to backend. Sending TOGGLE ON for Account A...');

    // 1. Send Toggle ON
    socket.emit('command', {
        type: 'TOGGLE_ACCOUNT',
        payload: { account: 'A', active: true }
    });
});

let messageCount = 0;
socket.on('system_status', (data) => {
    messageCount++;
    console.log(`[MSG #${messageCount}] Received Status: A_active=${data.accountA_active}`);

    if (messageCount > 10) {
        console.log('Audit complete. Closing probe.');
        process.exit(0);
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected.');
});

setTimeout(() => {
    console.log('Timeout. No response from backend.');
    process.exit(1);
}, 15000);
