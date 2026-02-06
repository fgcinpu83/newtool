// Test WebSocket connection from extension perspective
const WebSocket = require('ws');

console.log('🔧 TESTING WEBSOCKET CONNECTION');
console.log('================================');

const ws = new WebSocket('ws://127.0.0.1:8080');

ws.on('open', () => {
  console.log('✅ WebSocket connected to backend');
  console.log('📤 Sending test message...');

  // Send test message like extension would
  const testMsg = {
    event: 'endpoint_captured',
    data: {
      url: 'https://test.com/api/test',
      method: 'GET',
      response: '{"test": "data"}',
      detectedProvider: 'TEST',
      timestamp: Date.now()
    }
  };

  ws.send(JSON.stringify(testMsg));
  console.log('📤 Test message sent:', JSON.stringify(testMsg, null, 2));
});

ws.on('message', (data) => {
  console.log('📥 Received from backend:', data.toString());
});

ws.on('error', (err) => {
  console.log('❌ WebSocket error:', err.message);
  console.log('🔍 Possible issues:');
  console.log('   - Backend not running (check port 8080)');
  console.log('   - Firewall blocking connection');
  console.log('   - Wrong WebSocket URL');
});

ws.on('close', () => {
  console.log('🔌 WebSocket closed');
});

setTimeout(() => {
  console.log('⏰ Test complete - closing connection');
  ws.close();
}, 10000);