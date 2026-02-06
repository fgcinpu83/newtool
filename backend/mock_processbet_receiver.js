const http = require('http');
const querystring = require('querystring');

const port = process.env.PORT || 4001;

const server = http.createServer((req, res) => {
  if (req.url !== '/Betting/ProcessBet') {
    res.writeHead(404, {'Content-Type':'text/plain'});
    return res.end('Not Found');
  }
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let parsed;
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) {
      try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      parsed = querystring.parse(body);
    } else {
      parsed = body;
    }
    console.log('[MOCK] Received ProcessBet:', parsed);
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ status: 'OK', received: parsed }));
  });
});

server.listen(port, () => console.log(`[MOCK] ProcessBet receiver listening on ${port}`));

// Graceful shutdown
process.on('SIGINT', () => { console.log('[MOCK] Shutting down'); server.close(() => process.exit(0)); });
