const io = require('socket.io-client');
const socket = io('http://127.0.0.1:3001', { transports: ['websocket'] });

socket.on('connect', () => {
    console.log('Connected to backend (127.0.0.1)');

    console.log('Sending BYPASS_FILTERS...');
    socket.emit('command', {
        type: 'BYPASS_FILTERS'
    });

    console.log('Sending FORCE_ACTIVATE...');
    socket.emit('command', {
        type: 'FORCE_ACTIVATE',
        payload: { account: 'ALL' }
    });

    console.log('Success. Commands sent.');
});

socket.on('connect_error', (err) => {
    console.log('Connect error:', err.message);
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});

setTimeout(() => {
    socket.disconnect();
    process.exit(0);
}, 3000);
