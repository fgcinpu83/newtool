import io from 'socket.io-client';

const URL = process.env.BACKEND_URL || 'http://localhost:3001';
const socket = io(URL, { autoConnect: true, reconnection: true, transports: ['websocket'] });

socket.on('connect', async () => {
  console.log('[repro] connected', socket.id);

  // Set config with whitelabel URLs for both accounts
  socket.emit('command', { type: 'UPDATE_CONFIG', payload: { urlA: 'https://whitelabel.a/', urlB: 'https://whitelabel.b/' } });
  console.log('[repro] config set');

  // Allow backend a moment to process
  await new Promise(r => setTimeout(r, 500));

  // Core loop: toggle ON, wait 3s, OFF, ON again, repeat 10x
  for (let i = 0; i < 10; i++) {
    console.log(`[repro] iteration ${i+1} - TOGGLE A ON`);
    socket.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: 'A', active: true } });

    await new Promise(r => setTimeout(r, 3000));

    console.log(`[repro] iteration ${i+1} - TOGGLE A OFF`);
    socket.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: 'A', active: false } });

    // small pause
    await new Promise(r => setTimeout(r, 200));

    console.log(`[repro] iteration ${i+1} - TOGGLE A ON (again)`);
    socket.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: 'A', active: true } });

    // wait before next iteration
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('[repro] done, disconnecting');
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (e) => {
  console.error('[repro] connect_error', e && (e.message || e));
  process.exit(1);
});

socket.on('disconnect', () => console.log('[repro] disconnected'));
