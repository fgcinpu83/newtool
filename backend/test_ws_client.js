const WebSocket = require('ws');
const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const BACKEND_WS = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;
const gw = new WebSocket(BACKEND_WS, { headers: { Origin: 'http://localhost:3000' } });

gw.on('open', () => {
  console.log('open');
  const msg = { type: 'endpoint_captured', data: { url: 'https://qq188best.com/', frameUrl: 'https://qq188best.com/', account: 'A', type: 'STREAM_DATA', clientId: 'manual-test', payload: { Matchid: '123', HomeName: 'TeamA', AwayName: 'TeamB' } } };
  gw.send(JSON.stringify(msg));
  console.log('sent');
  setTimeout(()=>gw.close(),2000);
});

gw.on('error', (e) => console.log('err', e.message));

gw.on('close', ()=>console.log('closed'));

gw.on('message', (m) => console.log('msg from server', m.toString()));
