const io = require('socket.io-client');
const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const BACKEND_HTTP = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const socket = io(BACKEND_HTTP, { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('connected to socket.io server');
  const payload = {
    type: 'endpoint_captured',
    url: 'https://qq188best.com/api/odds',
    frameUrl: 'https://qq188best.com/iframe',
    account: 'A',
    responseBody: JSON.stringify({ ok: true }),
    clientId: 'E2E-SIO-1'
  };
  socket.send(JSON.stringify(payload));
  console.log('sent payload');
  setTimeout(() => { socket.close(); process.exit(0); }, 500);
});

socket.on('connect_error', (err) => { console.error('connect_error', err); process.exit(1); });
socket.on('error', (err) => { console.error('error', err); process.exit(1); });
