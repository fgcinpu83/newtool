const io = require('socket.io-client');
const socket = io('http://127.0.0.1:3001', { transports: ['websocket'] });

socket.on('connect', () => {
    console.log('✅ Connected to backend. Sending START_STRESS...');
    socket.emit('command', { type: 'START_STRESS' });

    // Give it a second to be received and then exit
    setTimeout(() => {
        console.log('🚀 STRESS-PROD command sent successfully.');
        process.exit(0);
    }, 1000);
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
});
