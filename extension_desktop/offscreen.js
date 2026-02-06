/**
 * ANTIGRAVITY OFFSCREEN DOCUMENT (v7.4)
 * Purpose: Maintain a persistent WebSocket connection that bypasses Service Worker hibernation.
 */

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const BACKEND_HTTP = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const BACKEND_WS = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;

let socket = null;
let isConnected = false;
let backendUrl = BACKEND_HTTP;

function connectSocket() {
    try {
        console.log(`[OFFSCREEN] 🌐 Connecting to ${backendUrl}...`);

        // Use Socket.IO client instead of raw WebSocket
        socket = io(backendUrl, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 3000,
            timeout: 5000
        });

        socket.on('connect', () => {
            console.log('[OFFSCREEN] ✅ Socket.IO Connected');
            isConnected = true;

            chrome.runtime.sendMessage({
                type: 'OFFSCREEN_STATUS',
                connected: true,
                timestamp: Date.now()
            });
        });

        socket.on('disconnect', () => {
            console.log(`[OFFSCREEN] 🔌 Socket.IO Disconnected`);
            isConnected = false;

            chrome.runtime.sendMessage({
                type: 'OFFSCREEN_STATUS',
                connected: false,
                timestamp: Date.now()
            });
        });

        socket.on('connect_error', (err) => {
            console.error('[OFFSCREEN] ❌ Socket.IO Connection error:', err.message);
            isConnected = false;
        });

        // Listen for backend commands
        socket.on('browser:command', (data) => {
            chrome.runtime.sendMessage({
                type: 'BACKEND_COMMAND',
                event: 'browser:command',
                data: data,
                timestamp: Date.now()
            });
        });

    } catch (err) {
        console.error('[OFFSCREEN] 💀 Fatal connect error:', err);
        setTimeout(connectSocket, 5000);
    }
}

// Receive messages from Background Service Worker
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SEND_PACKET' && isConnected && socket) {
        // 🔍 DEBUG SENSOR: Log extension to backend transmission
        console.log(`%c[DEBUG-SENSOR] 📡 EXTENSION→BACKEND: ${JSON.stringify({
            stage: 'EXTENSION_TO_BACKEND',
            timestamp: Date.now(),
            event: 'endpoint_captured',
            account: message.packet.account,
            provider: message.packet.provider,
            type: message.packet.type,
            url: message.packet.url?.substring(0, 100),
            dataSize: JSON.stringify(message.packet).length
        }, null, 2)}`, 'background:#ff9800;color:#fff;font-weight:bold');

        // Send via Socket.IO emit
        socket.emit('endpoint_captured', message.packet);
    }

    if (message.type === 'OFFSCREEN_PING') {
        chrome.runtime.sendMessage({ type: 'OFFSCREEN_PONG', timestamp: Date.now() });
    }
});

// Start connection
connectSocket();
