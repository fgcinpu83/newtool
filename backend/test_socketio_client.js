const { io } = require('socket.io-client');

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const BACKEND_HTTP = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const socket = io(BACKEND_HTTP, { transports: ['websocket'], reconnection: false });

socket.on('connect', () => {
  console.log('connected to backend, id=', socket.id);
  const payload = {
    type: 'endpoint_captured',
    url: 'https://qq188best.com/api/odds',
    frameUrl: 'https://qq188best.com/iframe',
    account: 'A',
    responseBody: JSON.stringify({ ok: true }),
    clientId: 'SOCKETIO-E2E-1'
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
