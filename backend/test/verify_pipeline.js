const io = require('socket.io-client');

const socket = io('http://localhost:3001');

const payloadA = {
    account: 'A',
    provider: 'BTI',
    type: 'odds_batch',
    data: [{
        matchId: 'evt_123',
        home: 'Manchester City',
        away: 'Liverpool',
        league: 'Premier League',
        market: 'FT_HDP',
        selection: 'Home',
        line: '-0.5',
        odds: '1.95',
        lastUpdated: Date.now()
    }]
};

const payloadB = {
    account: 'B',
    provider: 'CMD368',
    type: 'odds_batch',
    data: [{
        matchId: 'evt_456',
        home: 'Manchester City',
        away: 'Liverpool FC',
        league: 'English Premier League',
        market: 'FT_HDP',
        selection: 'Away',
        line: '0.5',
        odds: '2.10',
        lastUpdated: Date.now()
    }]
};

socket.on('connect', () => {
    console.log('Connected to Gateway. Injecting Data...');

    // 1. Inject Provider A
    console.log('Sending Provider A...');
    socket.emit('endpoint_captured', {
        account: 'A',
        provider: 'BTI',
        type: 'odds_batch',
        data: payloadA.data,
        timestamp: Date.now()
    });

    // Wait 1s then Inject Provider B (Packet 1)
    setTimeout(() => {
        console.log('Sending Provider B (Packet 1/2)...');
        socket.emit('endpoint_captured', {
            account: 'B',
            provider: 'CMD368',
            type: 'odds_batch',
            data: payloadB.data,
            timestamp: Date.now()
        });

        // Wait 2s then Inject Provider B (Packet 2 - To trigger Pairing after Discovery)
        setTimeout(() => {
            console.log('Sending Provider B (Packet 2/2)...');
            // Update timestamp to force process
            payloadB.data[0].lastUpdated = Date.now();
            socket.emit('endpoint_captured', {
                account: 'B',
                provider: 'CMD368',
                type: 'odds_batch',
                data: payloadB.data,
                timestamp: Date.now()
            });

            // Disconnect after 2s
            setTimeout(() => {
                console.log('Done. Check logs.');
                socket.disconnect();
            }, 2000);

        }, 2000);

    }, 1000);
});
