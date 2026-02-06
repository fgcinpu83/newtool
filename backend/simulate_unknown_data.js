const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
    console.log('✅ Connected to Gateway (RAW WS)');

    // Simulate an unknown packet that looks like match data
    const fakeData = {
        url: 'http://new-provider-debug.com/api/v1/live-matches',
        payload: {
            MatchId: "999888777",
            HomeTeam: "Debug Team A",
            AwayTeam: "Debug Team B",
            LeagueName: "Debug 리그",
            Odds: { "1": 1.95, "2": 1.95 }
        },
        account: 'DEBUG_ACCOUNT',
        type: 'api_contract_capture'
    };

    console.log('🚀 Injecting high-confidence unknown packet via "endpoint_captured" event...');
    // NestJS WsAdapter format
    ws.send(JSON.stringify({
        event: 'endpoint_captured',
        data: fakeData
    }));
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data);
        if (msg.event !== 'scanner:raw_feed' && msg.event !== 'debug:raw_b') {
            console.log('📥 Received from backend:', msg.event);
        }

        if (msg.event === 'UNKNOWN_PROVIDER_DATA') {
            console.log('🎯 SUCCESS: Backend detected unknown data and broadcasted to UI!');
            console.log('Data:', JSON.stringify(msg.data, null, 2));
            process.exit(0);
        }
    } catch (e) {
        // console.log('📥 Received (raw):', data.toString());
    }
});

ws.on('error', (err) => {
    console.error('❌ WebSocket Error:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.log('🛑 Timeout: No UNKNOWN_PROVIDER_DATA received from backend.');
    process.exit(1);
}, 5000);
