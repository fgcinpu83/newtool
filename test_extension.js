// Test script to monitor extension data capture
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/test') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Test Extension Data</title>
    <script>
        // Simulate extension data capture
        function sendTestData() {
            const testData = {
                type: 'api_contract_recorder',
                url: 'https://test-saba.com/api/getMatchList',
                method: 'api_contract_recorder_SABA',
                provider: 'ISPORT',
                account: 'A',
                responseBody: '{"matches":[{"home":"Arsenal","away":"Chelsea","odds":{"home":2.1,"away":3.2}}]}',
                capturedAt: Date.now()
            };

            // Send to bridge (simulating extension)
            const ws = new WebSocket('ws://localhost:8080');
            ws.onopen = () => {
                console.log('Sending test data...');
                ws.send(JSON.stringify({ event: 'endpoint_captured', data: testData }));
                setTimeout(() => ws.close(), 1000);
            };
        }

        setTimeout(sendTestData, 1000);
    </script>
</head>
<body>
    <h1>Testing Extension Data Capture</h1>
    <p>Open browser console to see test data being sent.</p>
    <button onclick="sendTestData()">Send Test Data</button>
</body>
</html>
    `);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8081, () => {
  console.log('Test server running on http://localhost:8081/test');
  console.log('Open this URL in Chrome with extension to test data capture');
});