const io = require('socket.io-client');
const http = require('http');

const server = 'http://127.0.0.1:3001';
let socket = null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function connectWithRetry({ maxAttempts = 8, initialDelay = 200, maxDelay = 2000 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`SIO: connect attempt ${attempt}/${maxAttempts}`);
    const s = io(server, { transports: ['polling', 'websocket'], timeout: 5000 });
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
      console.error(`SIO connect attempt ${attempt} failed:`, err && (err.message || err));
      if (attempt < maxAttempts) {
        console.log(`SIO: retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  throw new Error('socket.io connection failed after retries');
}

(async function mainConnect() {
  try {
    socket = await connectWithRetry();
    // register handlers after socket is available (registerSocketHandlers is declared below)
    registerSocketHandlers(socket);
  } catch (err) {
    console.error('E2E script: failed to connect to backend socket after retries', err && (err.message || err));
    process.exit(2);
  }
})();

function registerSocketHandlers(socket) {
  socket.on('connect', async () => {
    console.log('SIO connected', socket.id);
    socket.on('provider_contracts', d => console.log('EVENT provider_contracts', JSON.stringify(d)));
    socket.on('execution_history_db', d => console.log('EVENT execution_history_db', JSON.stringify(d)));
    socket.on('fsm:transition', d => console.log('EVENT fsm:transition', JSON.stringify(d)));
    socket.on('system_log', d => console.log('EVENT system_log', d && d.message));
    socket.on('toggle:failed', d => console.log('EVENT toggle:failed', JSON.stringify(d)));

    try {
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
  });

  socket.on('connect_error', e => {
    console.error('connect_error (handler)', e && (e.message || e));
    // Do not exit here — connectWithRetry will handle retries and mainConnect will exit if unrecoverable
  });
}

// connect errors are handled by retry/backoff logic in connectWithRetry() and logged in registerSocketHandlers().
