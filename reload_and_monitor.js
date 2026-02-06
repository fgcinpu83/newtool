console.log('🔄 Force reloading extension...');
console.log('📝 Please manually reload the extension in Chrome:');
console.log('   1. Open chrome://extensions/');
console.log('   2. Find "Antigravity Desktop Bridge"');
console.log('   3. Click the reload button (circular arrow)');
console.log('   4. Then open the betting site');
console.log('');
console.log('⏳ Waiting 10 seconds for manual reload...');

setTimeout(() => {
  console.log('✅ Assuming extension reloaded. Starting monitor...');

  // Start monitoring again
  const WebSocket = require('ws');
  const ws = new WebSocket('ws://localhost:8080');

  let captureCount = 0;

  ws.on('open', () => {
    console.log('🎯 Monitoring for EXTENSION DATA CAPTURE...');
    console.log('📝 Open betting site in Chrome with reloaded extension');
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
  }, 30000); // Monitor for 30 seconds

}, 10000);