const io = require('socket.io-client');
const socket = io('http://127.0.0.1:3001', {
    transports: ['websocket', 'polling']
});

socket.on('connect', () => {
    console.log('Connected to backend. ID:', socket.id);

    console.log('Sending OPEN_BROWSER command...');
    socket.emit('command', {
        type: 'OPEN_BROWSER',
        payload: {
            account: 'A',
            url: 'https://google.com'
        }
    });

    console.log('Command emitted. Waiting for 5 seconds to ensure delivery...');
    setTimeout(() => {
        console.log('Done. Check backend logs.');
        process.exit(0);
    }, 5000);
});

socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
    process.exit(1);
});
