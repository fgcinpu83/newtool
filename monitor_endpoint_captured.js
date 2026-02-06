const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

let captureCount = 0;
let startTime = Date.now();

console.log('🎯 MONITORING FOR ENDPOINT_CAPTURED EVENTS');
console.log('==========================================');

ws.on('open', () => {
  console.log('✅ Connected to backend WebSocket');
  console.log('⏳ Waiting for data from extension...');
  console.log('');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());

    if (msg.event === 'endpoint_captured') {
      captureCount++;
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      console.log('🎉 [' + elapsed + 's] CAPTURE #' + captureCount + ' RECEIVED!');
      console.log('   📍 URL:', msg.data?.url || 'unknown');
      console.log('   🏷️  Provider:', msg.data?.detectedProvider || 'unknown');
      console.log('   📊 Data size:', JSON.stringify(msg.data || {}).length, 'chars');
      console.log('   🔗 Frame URL:', (msg.data?.frameUrl || '').substring(0, 60) + '...');
      console.log('');

      if (captureCount >= 3) {
        console.log('🎊 SUCCESS! Extension is sending data to backend!');
        console.log('📈 Pipeline: Provider → Extension → Backend ✅');
        ws.close();
        process.exit(0);
      }
    }

    // Show status updates occasionally
    if (msg.event === 'system_status' && Math.random() < 0.1) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log('📊 [' + elapsed + 's] Status: A=' + (msg.data?.activeEventsA || 0) +
                 ' B=' + (msg.data?.activeEventsB || 0));
    }

  } catch (e) {}
});

ws.on('error', (err) => {
  console.log('❌ WebSocket Error:', err.message);
});

setTimeout(() => {
  console.log('');
  console.log('⏰ MONITOR COMPLETE (30 seconds)');
  console.log('📈 Total Captures:', captureCount);

  if (captureCount === 0) {
    console.log('⚠️  NO CAPTURES RECEIVED');
    console.log('');
    console.log('🔍 POSSIBLE ISSUES:');
    console.log('   1. Extension not sending data to offscreen');
    console.log('   2. Offscreen WebSocket not connected');
    console.log('   3. Data format mismatch');
    console.log('   4. Network blocking extension-backend communication');
    console.log('');
    console.log('💡 CHECK:');
    console.log('   - Extension console for [DEBUG-SENSOR] messages');
    console.log('   - chrome://extensions/ for offscreen errors');
    console.log('   - Background page console in DevTools');
  } else {
    console.log('✅ DATA FLOWING!');
  }

  ws.close();
  process.exit(0);
}, 30000);