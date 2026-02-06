const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

let captureCount = 0;

ws.on('open', () => {
  console.log('🎯 Monitoring for EXTENSION DATA CAPTURE...');
  console.log('📝 Extension should now be fixed. Open betting site in Chrome.');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());

    if (msg.event === 'endpoint_captured' || msg.data?.type === 'api_contract_recorder') {
      captureCount++;
      console.log('🎯 CAPTURED DATA #' + captureCount + ':');
      console.log('   Provider:', msg.data?.detectedProvider || msg.data?.provider);
      console.log('   Account:', msg.data?.account);
      console.log('   URL:', msg.data?.url?.substring(0, 60) + '...');
      console.log('   Method:', msg.data?.method);
      console.log('   Response Size:', msg.data?.responseBody?.length || 0);
      console.log('---');
    }

    if (msg.event === 'system_status' && Math.random() < 0.1) {
      console.log('🔧 System Status - Events A:', msg.data.activeEventsA, 'B:', msg.data.activeEventsB);
    }

  } catch (e) {}
});

ws.on('error', (err) => console.log('❌ Error:', err.message));

setTimeout(() => {
  console.log('🔚 Total captures:', captureCount);
  ws.close();
}, 60000);