// Test Socket.IO connection and endpoint_captured event
const io = require('socket.io-client');

const socket = io('http://localhost:3001', {
    transports: ['websocket']
});

socket.on('connect', () => {
    console.log('Connected to backend via Socket.IO');

    // Emit test endpoint_captured event
    const testData = {
        url: 'https://test.saba.com/api/getmatch',
        account: 'A',
        detectedProvider: 'SABA',
        type: 'api_response',
        data: { test: 'data' },
        clientId: 'test-client'
    };

    console.log('Emitting endpoint_captured event:', testData);
    socket.emit('endpoint_captured', testData);

    // Wait a bit then disconnect
    setTimeout(() => {
        socket.disconnect();
        process.exit(0);
    }, 2000);
});

socket.on('disconnect', () => {
    console.log('Disconnected from backend');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    process.exit(1);
});