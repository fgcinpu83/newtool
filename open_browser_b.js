const io = require('socket.io-client');
const URL = process.env.BACKEND_URL || 'http://localhost:3001';
console.log('Connecting to', URL);
const s = io(URL, { autoConnect: true });

s.on('connect', () => {
  console.log('[open_browser] connected', s.id);
  s.emit('command', { type: 'OPEN_BROWSER', payload: { account: 'B', url: 'https://example-b.com' } });
  setTimeout(() => { s.disconnect(); process.exit(0); }, 2000);
});

s.on('connect_error', (e) => { console.error('connect_error', e && e.message ? e.message : e); process.exit(1); });
