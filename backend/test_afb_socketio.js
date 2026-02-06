const { io } = require('socket.io-client');

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const BACKEND_HTTP = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const socket = io(BACKEND_HTTP, { transports: ['websocket'], reconnection: false });

// AFB88 Test Data - Format 1 (HomePrice/AwayPrice)
const afbTestData1 = {
  "error": "",
  "js": "if(NotGuest===0){window.location.reload();} NotGuest=1;",
  "db": [
    {
      "ServerTime": "2026-02-05 15:32:44",
      "AccId": "15588848",
      "CurCode": "IDR",
      "Balance": "6",
      "Balance2": "6.36"
    }
  ],
  "matches": [
    {
      "MatchId": "20995182",
      "HomeName": "Manchester City",
      "AwayName": "Newcastle United",
      "LeagueName": "ENGLISH PREMIER LEAGUE",
      "MatchDate": "2026-02-05",
      "MatchTime": "20:00",
      "HomePrice": 1.85,
      "AwayPrice": 3.90,
      "OverPrice": 1.95,
      "UnderPrice": 1.85,
      "market": "FT_HDP",
      "line": "0"
    },
    {
      "MatchId": "20995183",
      "HomeName": "Arsenal",
      "AwayName": "Chelsea",
      "LeagueName": "ENGLISH PREMIER LEAGUE",
      "MatchDate": "2026-02-05",
      "MatchTime": "22:00",
      "HomePrice": 2.10,
      "AwayPrice": 3.20,
      "OverPrice": 2.05,
      "UnderPrice": 1.75,
      "market": "FT_HDP",
      "line": "0"
    }
  ]
};

socket.on('connect', () => {
  console.log('connected to backend, id=', socket.id);

  // Send AFB88 data with proper URL pattern
  const payload = {
    type: 'endpoint_captured',
    url: 'https://afb88.com/api/v1/matches',
    frameUrl: 'https://afb88.com/iframe/sports',
    account: 'A',
    responseBody: JSON.stringify(afbTestData1),
    clientId: 'AFB88-TEST-001'
  };

  console.log('emitting AFB88 endpoint_captured', payload.clientId);
  socket.emit('endpoint_captured', payload);

  setTimeout(() => {
    socket.close();
    console.log('closed client');
    process.exit(0);
  }, 2000);
});

socket.on('connect_error', (err) => {
  console.error('connect_error', err && err.message);
  process.exit(1);
});

socket.on('error', (err) => {
  console.error('socket error', err);
});

socket.on('disconnect', (reason) => {
  console.log('disconnected', reason);
});