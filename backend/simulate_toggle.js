const { io } = require('socket.io-client');

const socket = io('http://localhost:3001');

socket.on('connect', () => {
    console.log('Connected to Backend!');

    const payload = {
        account: 'A',
        active: true,
        url: 'https://www.google.com'
    };

    console.log('Sending TOGGLE_ACCOUNT command for Account A...');
    socket.emit('command', {
        type: 'TOGGLE_ACCOUNT',
        payload
    });

    setTimeout(() => {
        console.log('Finished. Check wire_debug.log for results.');
        socket.disconnect();
        process.exit(0);
    }, 2000);
});

socket.on('connect_error', (err) => {
    console.error('Connection Error:', err.message);
    process.exit(1);
});
