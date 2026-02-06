// Monitor WebSocket messages from bridge
const WebSocket = require('ws');

console.log('🔍 Monitoring WebSocket bridge for extension data...');
console.log('Open betting sites in Chrome with extension loaded');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('✅ Connected to bridge (port 8080)');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());

    // Filter for relevant messages
    if (msg.event === 'endpoint_captured' ||
        msg.type === 'api_contract_recorder' ||
        msg.event === 'STREAM_DATA') {
      console.log('🎯 EXTENSION DATA CAPTURED:');
      console.log(JSON.stringify(msg, null, 2));
      console.log('---');
    }

    // Show system status occasionally
    if (msg.event === 'system_status' && Math.random() < 0.1) {
      console.log('📊 System Status:', JSON.stringify(msg.data, null, 2));
    }

  } catch (e) {
    // Ignore parse errors for non-JSON messages
  }
});

ws.on('error', (err) => {
  console.log('❌ WebSocket error:', err.message);
});

ws.on('close', () => {
  console.log('🔌 Connection closed, reconnecting...');
  setTimeout(() => process.exit(1), 1000); // Exit to restart
});

process.on('SIGINT', () => {
  console.log('👋 Shutting down monitor...');
  ws.close();
  process.exit(0);
});