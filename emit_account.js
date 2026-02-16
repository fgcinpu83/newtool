const io = require('socket.io-client');
const URL = process.env.BACKEND_URL || 'http://localhost:3001';
const account = process.argv[2] || 'A';
const targetUrl = process.argv[3] || (account === 'A' ? 'https://qq188best.com' : 'https://example-b.com');

console.log('Connecting to', URL, 'account=', account, 'targetUrl=', targetUrl);
const s = io(URL, { autoConnect: true });

s.on('connect', () => {
  console.log('[emit] connected', s.id);
  const payload = {};
  if (account === 'A') payload.urlA = targetUrl;
  else payload.urlB = targetUrl;
  console.log('[emit] -> UPDATE_CONFIG', JSON.stringify(payload));
  s.emit('command', { type: 'UPDATE_CONFIG', payload });

  // Wait for the backend to acknowledge the config via `system_status`
  const expectedUrl = account === 'A' ? payload.urlA : payload.urlB;
  const waitForConfig = (timeoutMs = 5000) => new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const check = (status) => {
      try {
        const acct = status && status.accountContexts && status.accountContexts[account];
        if (acct && acct.url && String(acct.url).trim() === expectedUrl) {
          return true;
        }
      } catch (e) {}
      return false;
    };

    const onStatus = (d) => {
      if (check(d)) {
        s.off('system_status', onStatus);
        resolve(true);
      }
    };

    s.on('system_status', onStatus);

    // Poll GET_STATUS until deadline
    const poll = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(poll);
        try { s.off('system_status', onStatus); } catch (e) {}
        resolve(false);
        return;
      }
      try { s.emit('command', { type: 'GET_STATUS' }); } catch (e) {}
    }, 300);
  });

  (async () => {
    const ok = await waitForConfig(12000);
    if (!ok) console.warn('[emit] WARNING: config ack not observed before timeout');

    console.log('[emit] -> TOGGLE_ACCOUNT', account, 'ON');
    // Include the target URL in the TOGGLE payload to help the router diagnosis
    const togglePayload = { account, active: true, url: expectedUrl };
    s.emit('command', { type: 'TOGGLE_ACCOUNT', payload: togglePayload });

    // final GET_STATUS to update UI
    setTimeout(() => {
      console.log('[emit] -> GET_STATUS');
      s.emit('command', { type: 'GET_STATUS' });
    }, 1200);
  })();

  // Keep connection open longer to allow backend processing and logging
  setTimeout(() => {
    console.log('[emit] disconnecting');
    try { s.disconnect(); } catch (e) {}
    try { process.exit(0); } catch (e) {}
  }, 15000);
});

s.on('connect_error', (e) => {
  console.error('connect_error', e && e.message ? e.message : e);
  process.exit(1);
});

s.on('disconnect', () => console.log('[emit] disconnected'));

s.on('system_status', (d) => console.log('[evt] system_status', JSON.stringify(d).substring(0,400)));
s.on('backend_state', (d) => console.log('[evt] backend_state', JSON.stringify(d).substring(0,400)));