const WebSocket = require('ws');
const fs = require('fs');

// Determine WS URL: env MONITOR_WS_URL -> monitor_config.json -> default
let monitorConfig = {};
try {
  const cfg = fs.readFileSync(__dirname + '/monitor_config.json', 'utf8');
  monitorConfig = JSON.parse(cfg || '{}');
} catch (e) { }

const wsUrl = process.env.MONITOR_WS_URL || monitorConfig.wsUrl || 'ws://localhost:8080';
const ws = new WebSocket(wsUrl);

let captureCount = 0;

ws.on('open', () => {
  console.log('🎯 Monitoring for EXTENSION DATA CAPTURE...');
  console.log('📝 Open betting site in Chrome with extension loaded');
  console.log('🔗 Connected to:', wsUrl);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());

    // Monitor for captured data
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

    // Show system status occasionally
    if (msg.event === 'system_status' && Math.random() < 0.05) {
      console.log('🔧 System Status - Events A:', msg.data.activeEventsA, 'B:', msg.data.activeEventsB);
    }

  } catch (e) {}
});

ws.on('error', (err) => console.log('❌ Error:', err.message));

setTimeout(() => {
  console.log('🔚 Total captures:', captureCount);
  ws.close();
}, 60000); // Monitor for 1 minute