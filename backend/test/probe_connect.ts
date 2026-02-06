
import { io } from 'socket.io-client';

// NOTE: This runs on HOST, so we use localhost.
// But we emulate the SNIFFER structure to test Backend Acceptance.
const socket = io('http://localhost:3001', {
    transports: ['websocket'],
    forceNew: true
});

console.log('🕵️ CONNECTIVITY PROBE STARTED.');

socket.on('connect', () => {
    console.log('✅ Connected to Gateway.');

    // SIMULATE SNIFFER PAYLOAD
    console.log('📤 Sending SIMULATED AFB88 Session...');
    socket.emit('endpoint_captured', {
        account: 'A',
        type: 'session_capture',
        provider: 'AFB88',
        data: {
            cookie: 'TEST_COOKIE_PROBE',
            userAgent: 'TEST_UA_PROBE',
            url: 'http://test-probe.com'
        },
        timestamp: Date.now()
    });
});

socket.on('disconnect', () => console.log('❌ Disconnected'));

// Monitor for EFFECT
socket.on('guardian:status', (data: any) => {
    const entry = data['A:AFB88'];
    if (entry) {
        console.log(`[PROBE] Guardian State for A: ${entry.state}`);
        if (entry.state !== 'NO_DATA') {
            console.log('✅ SUCCESS: Backend accepted session and changed state/started worker.');
            process.exit(0);
        }
    }
});

// Timeout
setTimeout(() => {
    console.log('⏰ Timeout waiting for state change.');
    process.exit(0);
}, 5000);
