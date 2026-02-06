const WebSocket = require('ws');

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const WS_BASE = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;
const ws = new WebSocket(`${WS_BASE}/socket.io/?EIO=4&transport=websocket`);

ws.on('open', () => {
    console.log('✅ Connected to Backend');
    ws.send('40');

    const payload = {
        account: 'B',
        provider: 'ISPORT',
        type: 'session_capture',
        data: {
            url: 'https://qq188.com/Sports',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            cookies: 'test=DEBOUNCE_CHECK; session=static_session;',
            cookieCount: 2
        }
    };

    console.log('💉 Injecting Session First Time...');
    ws.send(`42["endpoint_captured",${JSON.stringify(payload)}]`);

    setTimeout(() => {
        console.log('💉 Injecting SAME Session Second Time (Should be ignored)...');
        ws.send(`42["endpoint_captured",${JSON.stringify(payload)}]`);

        setTimeout(() => {
            console.log('👋 Done.');
            process.exit(0);
        }, 3000);
    }, 2000);
});
