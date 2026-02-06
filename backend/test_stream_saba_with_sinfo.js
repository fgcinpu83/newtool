const { io } = require('socket.io-client');

// Usage: node test_stream_saba_with_sinfo.js [host] [port] [events] [intervalMs]
// Example: node test_stream_saba_with_sinfo.js 127.0.0.1 3001 10 200

const host = process.argv[2] || '127.0.0.1';
const port = process.argv[3] || '3001';
const total = Number(process.argv[4] || '10');
const intervalMs = Number(process.argv[5] || '200');

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

    const matchesCount = 1 + Math.floor(Math.random() * 2);
    const matchList = [];
    for (let i = 0; i < matchesCount; i++) {
      const selections = [];
      for (let s = 0; s < 3; s++) {
        selections.push({ SelectionId: 'S' + randId(), Price: randFloat(1.1, 5.0) });
      }

      matchList.push({
        MatchId: randId(),
        HomeName: `Team_${Math.floor(Math.random() * 200)}`,
        AwayName: `Team_${Math.floor(Math.random() * 200)}`,
        Markets: [ { MarketId: 'M' + randId(), Selections: selections } ]
      });
    }

    const sinfoToken = 'TEST-SINFO-A-' + Date.now();
    const payload = {
      type: 'endpoint_captured',
      url: 'https://saba.example.com/Data',
      frameUrl: 'https://saba.example.com/',
      account: 'A',
      sinfo: sinfoToken,
      responseBody: JSON.stringify({ d: { MatchList: matchList }, sinfo: sinfoToken }),
      clientId: 'STREAM-SABA-' + Date.now()
    };

    socket.emit('endpoint_captured', payload);
    console.log('emitted event with sinfo=', sinfoToken);
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
