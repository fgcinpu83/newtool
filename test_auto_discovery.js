/**
 * TEST AUTO-DISCOVERY FLOW
 * Simulates unknown match data traffic to verify "Traffic Inspector" trigger.
 */
const WebSocket = require('ws');

const GATEWAY_URL = 'ws://localhost:8080';
const socket = new WebSocket(GATEWAY_URL);

socket.on('open', () => {
    console.log('✅ Connected to Gateway');

    // 1. Simulate UNKNOWN but SUBSTANTIVE Match Data
    const payload = {
        event: 'endpoint_captured',
        data: {
            url: 'https://new-sportsbook.com/api/v1/get_hidden_odds',
            method: 'GET',
            account: 'B',
            // Payload that triggers the heuristic (Confidence > 70%)
            responseBody: JSON.stringify([
                { MatchId: '123', HomeName: 'Arsenal', AwayName: 'Chelsea', Odds: 1.85, Markets: 'FT_HDP' },
                { MatchId: '124', HomeName: 'Liverpool', AwayName: 'Man City', Odds: 2.10, Markets: 'FT_OU' }
            ]),
            timestamp: Date.now()
        }
    };

    console.log('📤 Sending substantive unknown traffic...');
    socket.send(JSON.stringify(payload));

    // 2. Listen for response (System Log)
    socket.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            if (msg.event === 'system_log') {
                console.log('📝 [LOG FROM BACKEND]:', msg.data.message);
            }
        } catch (e) { }
    });

    setTimeout(() => {
        console.log('🏁 Test finished. Check Dashboard for "Traffic Inspector" panel.');
        process.exit(0);
    }, 5000);
});

socket.on('error', (err) => {
    console.error('❌ Connection error. Is backend running on port 8080?');
    process.exit(1);
});
