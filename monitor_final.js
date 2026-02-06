const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

let captureCount = 0;
let lastStatus = null;

ws.on('open', () => {
  console.log('🎯 MONITORING EXTENSION DATA FLOW...');
  console.log('📊 Backend WebSocket: ✅ Connected');
  console.log('⏳ Waiting for extension data...');
  console.log('');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());

    if (msg.event === 'endpoint_captured' || msg.data?.type === 'api_contract_recorder') {
      captureCount++;
      console.log('🎯 CAPTURED DATA #' + captureCount + ' ✅');
      console.log('   Provider:', msg.data?.detectedProvider || msg.data?.provider || 'unknown');
      console.log('   Account:', msg.data?.account || 'unknown');
      console.log('   URL:', (msg.data?.url || '').substring(0, 60) + '...');
      console.log('   Method:', msg.data?.method || 'unknown');
      console.log('   Response Size:', (msg.data?.responseBody || '').length || 0);
      console.log('   Timestamp:', new Date().toLocaleTimeString());
      console.log('---');
    }

    if (msg.event === 'system_status') {
      const status = msg.data;
      if (JSON.stringify(status) !== JSON.stringify(lastStatus)) {
        console.log('🔧 System Status Update:');
        console.log('   Events A:', status.activeEventsA || 0, 'B:', status.activeEventsB || 0);
        console.log('   Provider:', status.provider || 'none');
        console.log('   Pipeline:', status.pipelineStatus || 'unknown');
        lastStatus = status;
      }
    }

  } catch (e) {}
});

ws.on('error', (err) => console.log('❌ WebSocket Error:', err.message));

setTimeout(() => {
  console.log('');
  console.log('🔚 MONITOR COMPLETE');
  console.log('📊 Total Captures:', captureCount);
  if (captureCount === 0) {
    console.log('❌ NO DATA RECEIVED - Extension not sending data');
    console.log('💡 Check:');
    console.log('   1. Extension reloaded at chrome://extensions/');
    console.log('   2. Betting site opened and logged in');
    console.log('   3. No console errors in DevTools');
  } else {
    console.log('✅ DATA FLOWING - Odds capture working!');
  }
  ws.close();
}, 30000);