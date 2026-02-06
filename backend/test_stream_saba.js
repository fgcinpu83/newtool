const { io } = require('socket.io-client');

// Usage: node test_stream_saba.js [host] [port] [events] [intervalMs]
// Example: node test_stream_saba.js 127.0.0.1 3001 1000 50

const host = process.argv[2] || '127.0.0.1';
const port = process.argv[3] || '3001';
const total = Number(process.argv[4] || '500');
const intervalMs = Number(process.argv[5] || '100');

const url = `http://${host}:${port}`;
const socket = io(url, { reconnection: true, reconnectionAttempts: 5, timeout: 5000 });

function randFloat(min, max) {
  return +(Math.random() * (max - min) + min).toFixed(2);
}

function randId() {
  return Math.floor(Math.random() * 1000000);
}

socket.on('connect', () => {
  console.log('connected to backend', url, 'socketId=', socket.id);
  let sent = 0;
  const t = setInterval(() => {
    if (sent >= total) {
      clearInterval(t);
      console.log('done sending', sent, 'events');
      socket.close();
      return;
    }

    const matchesCount = 1 + Math.floor(Math.random() * 3);
    const matchList = [];
    for (let i = 0; i < matchesCount; i++) {
      matchList.push({
        MatchId: randId(),
        HomeName: `Team_${Math.floor(Math.random() * 200)}`,
        AwayName: `Team_${Math.floor(Math.random() * 200)}`,
        Markets: [ { Odds: [ { Price: randFloat(1.1, 5.0) }, { Price: randFloat(1.1, 5.0) }, { Price: randFloat(1.1, 5.0) } ] } ]
      });
    }

    const payload = {
      type: 'endpoint_captured',
      url: 'https://saba.example.com/Data',
      frameUrl: 'https://saba.example.com/',
      account: 'A',
      responseBody: JSON.stringify({ d: { MatchList: matchList } }),
      clientId: 'STREAM-SABA-' + Date.now()
    };

    socket.emit('endpoint_captured', payload);
    sent++;
  }, intervalMs);
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
