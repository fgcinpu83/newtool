const { io } = require('socket.io-client');

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const BACKEND_HTTP = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const socket = io(BACKEND_HTTP, { reconnection: false });

socket.on('connect', () => {
  console.log('connected to backend, id=', socket.id);
  const payload = {
    type: 'endpoint_captured',
    url: 'https://saba.example.com/Data',
    frameUrl: 'https://saba.example.com/',
    account: 'A',
    responseBody: JSON.stringify({ d: { MatchList: [{ MatchId: 123, Odds: [1.5, 2.5] }] } }),
    clientId: 'SOCKETIO-SABA-1'
  };
  console.log('emitting endpoint_captured', payload.clientId);
  socket.emit('endpoint_captured', payload);
  setTimeout(() => {
    socket.close();
    console.log('closed client');
    process.exit(0);
  }, 1000);
});

socket.on('connect_error', (err) => {
  console.error('connect_error', err && err.message);
  process.exit(1);
});

socket.on('error', (err) => {
  console.error('socket error', err);
});

socket.on('disconnect', (reason) => {
  console.log('disconnected', reason);
});
