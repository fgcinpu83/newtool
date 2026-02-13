// Create immediate marker before any requires to ensure we record process start
const fs = require('fs');
const path = require('path');
try { fs.writeFileSync(path.join(__dirname, 'force_client_started.marker'), new Date().toISOString()); } catch (e) { console.error('marker write failed', e) }

const io = require('socket.io-client');

const LOG_PATH = path.join(__dirname, 'force_client_log.txt');
function log(...args) {
  const line = `[${new Date().toISOString()}] ` + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  fs.appendFileSync(LOG_PATH, line + '\n');
  console.log(line);
}

// Immediate marker so we can detect the process started
try { fs.writeFileSync(path.join(__dirname, 'force_client_started.marker'), new Date().toISOString()); } catch (e) { console.error('marker write failed', e) }

const URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
log('Connecting to', URL);

const socket = io(URL, { transports: ['websocket', 'polling'], reconnectionAttempts: 5, timeout: 5000 });

socket.on('connect', () => {
  log('connected', socket.id);

  socket.on('system_status', (d) => log('evt system_status', d));
  socket.on('backend_state', (d) => log('evt backend_state', d));
  socket.on('debug:opps', (d) => log('evt debug:opps', d));
  socket.on('browser:opened', (d) => log('evt browser:opened', d));
  socket.on('browser:error', (d) => log('evt browser:error', d));

  // Emit sequence
  setTimeout(() => {
    log('-> GET_STATUS');
    socket.emit('command', { type: 'GET_STATUS' });
  }, 300);

  setTimeout(() => {
    log('-> TOGGLE_ACCOUNT A ON');
    socket.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: 'A', active: true } });
  }, 900);

  setTimeout(() => {
    log('-> TOGGLE_ACCOUNT A OFF');
    socket.emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: 'A', active: false } });
  }, 1800);

  setTimeout(() => {
    log('-> OPEN_BROWSER A');
    socket.emit('command', { type: 'OPEN_BROWSER', payload: { account: 'A', url: 'https://example.com' } });
  }, 2600);

  setTimeout(() => {
    log('-> UPDATE_CONFIG');
    socket.emit('command', { type: 'UPDATE_CONFIG', payload: { min: 1.5, max: 10.0 } });
  }, 3500);

  setTimeout(() => {
    log('-> LOG_OPPS');
    socket.emit('command', { type: 'LOG_OPPS', payload: { sample: [{ id: 'op1', profit: 3.2 }] } });
  }, 4200);

  // Finish
  setTimeout(() => {
    log('Done - disconnecting');
    socket.disconnect();
    process.exit(0);
  }, 6000);
});

socket.on('connect_error', (err) => {
  log('connect_error', err && err.message ? err.message : String(err));
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  log('disconnected', reason);
});

// Ensure log file exists
try { fs.writeFileSync(LOG_PATH, `Force client started at ${new Date().toISOString()}\n`); } catch (e) { console.error('failed to create log', e) }
