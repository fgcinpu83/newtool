const { io } = require('socket.io-client');

const URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
console.log('Connecting to', URL);
const s = io(URL, { transports: ['websocket'], reconnection: false, timeout: 5000 });

s.on('connect', () => {
  console.log('connected as', s.id);
  const payload = { ts: Date.now(), account: 'A' };
  console.log('emitting client_ping', payload);
  s.emit('client_ping', payload);
  setTimeout(() => {
    s.disconnect();
    process.exit(0);
  }, 500);
});

s.on('connect_error', (err) => {
  console.error('connect_error', err && err.message);
  process.exit(1);
});

s.on('pong', (m) => console.log('pong', m));
