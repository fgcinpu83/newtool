const io = require('socket.io-client');
const URL = process.env.BACKEND_URL || 'http://localhost:3001';
console.log('Connecting to', URL);
const s = io(URL, { autoConnect: true });

s.on('connect', () => {
  console.log('[emit] connected', s.id);
  // Send UPDATE_CONFIG for urlA
  const urlA = process.env.TEST_URLA || 'https://qq188best.com';
  console.log('[emit] -> UPDATE_CONFIG urlA=', urlA);
  s.emit('command', { type: 'UPDATE_CONFIG', payload: { urlA } });

  setTimeout(() => {
    console.log('[emit] -> TOGGLE_ACCOUNT A ON');
    s.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: 'A', active: true } });
  }, 600);

  setTimeout(() => {
    console.log('[emit] -> GET_STATUS');
    s.emit('command', { type: 'GET_STATUS' });
  }, 1600);

  setTimeout(() => {
    console.log('[emit] disconnecting');
    s.disconnect();
    process.exit(0);
  }, 2600);
});

s.on('connect_error', (e) => {
  console.error('connect_error', e && e.message ? e.message : e);
  process.exit(1);
});

s.on('disconnect', () => console.log('[emit] disconnected'));

s.on('system_status', (d) => console.log('[evt] system_status', JSON.stringify(d).substring(0,400)));
s.on('backend_state', (d) => console.log('[evt] backend_state', JSON.stringify(d).substring(0,400)));