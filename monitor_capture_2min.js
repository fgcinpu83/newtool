const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

let captureCount = 0;
let lastCapture = null;
let startTime = Date.now();

ws.on('open', () => {
  console.log('🔌 Backend WebSocket connected - Monitoring for 2 minutes...');
  console.log('⏳ Waiting for extension data from betting site...');
  console.log('');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());

    if (msg.event === 'endpoint_captured') {
      captureCount++;
      lastCapture = new Date().toISOString();
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      console.log('🎯 [' + elapsed + 's] CAPTURE #' + captureCount);
      console.log('   Provider:', msg.data?.detectedProvider || 'unknown');
      console.log('   URL:', (msg.data?.url || '').substring(0, 60) + '...');
      console.log('   Data size:', JSON.stringify(msg.data || {}).length, 'chars');
      console.log('');
    }

    if (msg.event === 'system_status' && captureCount === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log('📊 [' + elapsed + 's] Status: A=' + (msg.data?.activeEventsA || 0) +
                 ' B=' + (msg.data?.activeEventsB || 0) + ' | Balance A: ' + (msg.data?.balanceA || '0.00'));
    }

  } catch (e) {}
});

ws.on('error', (err) => console.log('❌ WebSocket Error:', err.message));

setTimeout(() => {
  console.log('');
  console.log('⏰ MONITOR COMPLETE (2 minutes)');
  console.log('📈 Total Captures:', captureCount);

  if (captureCount === 0) {
    console.log('⚠️  NO DATA RECEIVED - Extension not sending data');
    console.log('');
    console.log('🔍 TROUBLESHOOTING:');
    console.log('   1. Check chrome://extensions/ - reload extension');
    console.log('   2. Navigate to SOCCER (REAL) section in betting site');
    console.log('   3. Open DevTools (F12) and check Console for [DEBUG-SENSOR]');
    console.log('   4. Run in console: window.__GRAVITY_SNIFFER_INJECTED__ (should be true)');
    console.log('   5. Try refreshing the betting site page');
  } else {
    console.log('✅ DATA FLOWING - Pipeline working!');
    console.log('📊 Last capture:', lastCapture);
  }

  ws.close();
  process.exit(0);
}, 120000);