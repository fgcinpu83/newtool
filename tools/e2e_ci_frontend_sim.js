const io = require('socket.io-client');
const http = require('http');
const WebSocket = require('ws');

const server = process.env.BACKEND_URL || 'http://localhost:3001';
let socket = null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function websocketProbe(timeout = 3000) {
  // Try a low-level websocket to the socket.io websocket endpoint — diagnostic + transport check
  try {
    const wsUrl = server.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';
    console.log(`WS PROBE: attempting raw WebSocket -> ${wsUrl}`);
    return await new Promise((resolve) => {
      const ws = new WebSocket(wsUrl, { handshakeTimeout: Math.max(1000, timeout) });
      let done = false;
      const cleanup = () => { try { ws.terminate(); } catch (_) {} };
      ws.once('open', () => { done = true; cleanup(); resolve(true); });
      ws.once('error', (e) => { if (!done) { done = true; cleanup(); resolve(false); } });
      setTimeout(() => { if (!done) { done = true; cleanup(); resolve(false); } }, timeout);
    });
  } catch (e) {
    return false;
  }
}

async function connectWithRetry({ maxAttempts = 8, initialDelay = 200, maxDelay = 2000 } = {}) {
  // Choose connection preference: websocket-first for localhost or when overridden
  const parsed = new URL(server);
  const host = parsed.hostname;
  const preferWebSocket = (process.env.E2E_SOCKET_TRANSPORT === 'websocket') || ['127.0.0.1', 'localhost', '::1'].includes(host);

  if (preferWebSocket) {
    console.log('SIO: prefer websocket-only transport (localhost or forced)');
    // Try websocket-only first
    for (let attempt = 1; attempt <= Math.ceil(maxAttempts / 1.5); attempt++) {
      console.log(`SIO: websocket-only connect attempt ${attempt}/${Math.ceil(maxAttempts/1.5)}`);
      const s = io(server, { transports: ['websocket'], forceNew: true, timeout: 4000 });
      try {
        await new Promise((resolve, reject) => {
          const onConnect = () => { s.off('connect_error', onError); resolve(); };
          const onError = (err) => { s.off('connect', onConnect); reject(err); };
          s.once('connect', onConnect);
          s.once('connect_error', onError);
        });
        return s;
      } catch (err) {
        try { s.close(); } catch (_) {}
        const delay = Math.min(initialDelay * 2 ** (attempt - 1), maxDelay);
        console.error(`SIO websocket-only attempt ${attempt} failed:`, err && (err.message || err));
        if (attempt < Math.ceil(maxAttempts / 1.5)) {
          console.log(`SIO (ws-only): retrying in ${delay}ms`);
          await sleep(delay);
        }
      }
    }

    // If ws-only didn't work, fall through to polling+websocket attempts below
    console.log('SIO: websocket-only attempts exhausted, falling back to polling+websocket');
  }

  // Normal socket.io connect (polling + websocket)
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`SIO: connect attempt ${attempt}/${maxAttempts} (polling+websocket)`);
    const s = io(server, { transports: ['polling', 'websocket'], timeout: 5000 });
    try {
      await new Promise((resolve, reject) => {
        const onConnect = () => { console.log('connectWithRetry: socket connect event'); s.off('connect_error', onError); resolve(); };
        const onError = (err) => { console.log('connectWithRetry: socket connect_error event', err && (err.message || err)); s.off('connect', onConnect); reject(err); };
        s.once('connect', onConnect);
        s.once('connect_error', onError);
      });
      return s;
    } catch (err) {
      try { s.close(); } catch (_) {}
      const delay = Math.min(initialDelay * 2 ** (attempt - 1), maxDelay);
      console.error(`SIO connect attempt ${attempt} failed:`, err && (err.message || err));
      if (attempt < maxAttempts) {
        console.log(`SIO: retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  // If regular attempts fail, probe raw WebSocket transport — sometimes polling is blocked but websocket works
  const wsOk = await websocketProbe(2000);
  if (wsOk) {
    console.log('WS PROBE: raw WebSocket OK — retrying socket.io using websocket-only transport');
    // Try websocket-only socket.io connects (shorter retry series)
    for (let attempt = 1; attempt <= Math.ceil(maxAttempts / 2); attempt++) {
      console.log(`SIO: websocket-only connect attempt ${attempt}/${Math.ceil(maxAttempts/2)}`);
      const s = io(server, { transports: ['websocket'], forceNew: true, timeout: 3000 });
      try {
        await new Promise((resolve, reject) => {
          const onConnect = () => { s.off('connect_error', onError); resolve(); };
          const onError = (err) => { s.off('connect', onConnect); reject(err); };
          s.once('connect', onConnect);
          s.once('connect_error', onError);
        });
        return s;
      } catch (err) {
        try { s.close(); } catch (_) {}
        const delay = Math.min(initialDelay * 2 ** (attempt - 1), maxDelay);
        console.error(`SIO websocket-only attempt ${attempt} failed:`, err && (err.message || err));
        if (attempt < Math.ceil(maxAttempts / 2)) {
          console.log(`SIO (ws-only): retrying in ${delay}ms`);
          await sleep(delay);
        }
      }
    }
  } else {
    console.warn('WS PROBE: raw WebSocket probe failed (network/policy may block socket.io polling and ws)');
  }

  throw new Error('socket.io connection failed after retries (including websocket fallback)');
}

async function waitForBackendHealth(timeoutMs = 10000, interval = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const code = await new Promise((resolve, reject) => {
        const hostname = 'localhost';
        const req = http.request({ hostname, port: 3001, path: '/health', method: 'GET', timeout: 2000 }, res => { resolve(res.statusCode); res.on('data', () => {}); });
        req.on('error', () => reject(new Error('no-http')));
        req.end();
      });
      if (code === 200) {
        console.log('BACKEND: /health => 200');
        return true;
      }
    } catch (e) {
      // ignore — will retry
    }
    await sleep(interval);
  }
  console.warn('BACKEND: /health did not respond within timeout');
  return false;
}

(async function mainConnect() {
  // wait for HTTP health before attempting socket.io (helps CI race conditions)
  const healthy = await waitForBackendHealth(10000, 250);
  if (!healthy) console.warn('Proceeding to socket connect even though /health failed (will rely on connect retries)');

  try {
    // Fast-path: try a short websocket-only connect on localhost or when forced
    let directTried = false;
    if (process.env.E2E_SOCKET_TRANSPORT === 'websocket' || server.includes('localhost') || server.includes('127.0.0.1')) {
      directTried = true;
      try {
        console.log('MAIN: attempting short websocket-only connect (fast-path)');
        const s = io(server, { transports: ['websocket'], forceNew: true, timeout: 3000 });
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => { try { s.close(); } catch (_) {} ; reject(new Error('ws-short-timeout')); }, 3000);
          s.once('connect', () => { clearTimeout(timer); resolve(); });
          s.once('connect_error', (e) => { clearTimeout(timer); reject(e); });
        });
        socket = s;
        console.log('MAIN: websocket-only fast-path connected');
      } catch (e) {
        console.log('MAIN: websocket-only fast-path failed, falling back to retry:', e && e.message);
      }
    }

    if (!socket) {
      socket = await connectWithRetry();
    }

    console.log('MAIN: socket object:', { connected: !!socket?.connected, id: socket && socket.id });

    // register handlers after socket is available (registerSocketHandlers is declared below)
    registerSocketHandlers(socket);
  } catch (err) {
    console.error('E2E script: failed to connect to backend socket after retries', err && (err.message || err));
    process.exit(2);
  }
})();

function registerSocketHandlers(socket) {
  const onConnected = async () => {
    try {
      console.log('SIO connected', socket.id);
      socket.on('provider_contracts', d => console.log('EVENT provider_contracts', JSON.stringify(d)));
      socket.on('execution_history_db', d => console.log('EVENT execution_history_db', JSON.stringify(d)));
      socket.on('fsm:transition', d => console.log('EVENT fsm:transition', JSON.stringify(d)));
      socket.on('system_log', d => console.log('EVENT system_log', d && d.message));
      socket.on('toggle:failed', d => console.log('EVENT toggle:failed', JSON.stringify(d)));

      console.log('STEP: update config');
      socket.emit('command', { type: 'UPDATE_CONFIG', payload: { urlA: 'https://qq188best.com' } });
      await sleep(200);

      console.log('STEP: set injected+cdp readiness');
      socket.emit('endpoint_captured', { account: 'A', source: 'injected', url: 'https://qq188best.com/iframe', type: 'lifecycle_signal', stage: 'INJECTED_READY' });
      socket.emit('endpoint_captured', { account: 'A', source: 'cdp', url: 'https://qq188best.com/iframe', type: 'lifecycle_signal', stage: 'CDP_READY' });
      await sleep(200);

      console.log('STEP: toggle ON account A');
      socket.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: 'A', active: true } });

      await sleep(400);
      // publish internal BROWSER_OPENED
      const postData = JSON.stringify({ type: 'BROWSER_OPENED', payload: { account: 'A', url: 'https://qq188best.com' } });
      const req = http.request({ hostname: '127.0.0.1', port: 3001, path: '/api/debug/publish-internal', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } }, res => {
        console.log('HTTP publish-internal status', res.statusCode);
        res.on('data', () => { });
      });
      req.on('error', e => console.error('HTTP publish-internal err', e && e.message));
      req.write(postData);
      req.end();

      // wait for FSM transition
      await sleep(1500);

      console.log('STEP: MARK_PROVIDER (A)');
      socket.emit('command', { type: 'MARK_PROVIDER', payload: { account: 'A', endpointPattern: '/api/v1/matches', method: 'GET' } });
      await sleep(500);

      console.log('STEP: LIST_PROVIDER_CONTRACTS');
      socket.emit('command', { type: 'LIST_PROVIDER_CONTRACTS' });
      await sleep(500);

      console.log('STEP: GET_EXECUTION_HISTORY');
      socket.emit('command', { type: 'GET_EXECUTION_HISTORY', payload: { limit: 10 } });
      await sleep(500);

      console.log('STEP: DELETE_PROVIDER_CONTRACT');
      socket.emit('command', { type: 'DELETE_PROVIDER_CONTRACT', payload: { account: 'A' } });
      await sleep(500);

      console.log('E2E simulation complete — closing socket');
      socket.close();
      process.exit(0);
    } catch (err) {
      console.error('E2E script caught', err && err.message);
      socket.close();
      process.exit(2);
    }
  };

  // attach handler and invoke immediately if already connected
  socket.on('connect', onConnected);
  if (socket.connected) {
    // already connected — call handler directly
    onConnected().catch(err => { console.error('onConnected error', err && err.message); });
  }

  socket.on('connect_error', e => {
    console.error('connect_error (handler)', e && (e.message || e));
    // Do not exit here — connectWithRetry will handle retries and mainConnect will exit if unrecoverable
  });
}

// connect errors are handled by retry/backoff logic in connectWithRetry() and logged in registerSocketHandlers().
