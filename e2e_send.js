const WebSocket = require('ws');
const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const BACKEND_WS = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;
const ws = new WebSocket(BACKEND_WS);

ws.on('open', () => {
  console.log('connected');
  const payload = {
    type: 'endpoint_captured',
    url: 'https://qq188best.com/api/odds',
    frameUrl: 'https://qq188best.com/iframe',
    account: 'A',
    responseBody: JSON.stringify({ ok: true }),
    clientId: 'E2E-SCRIPT-1'
  };
  ws.send(JSON.stringify(payload));
  console.log('sent payload');
  setTimeout(() => { ws.close(); process.exit(0); }, 500);
});

ws.on('error', (err) => { console.error('ws error', err); process.exit(1); });

ws.on('message', (msg) => { console.log('recv', msg.toString()); });
