const io = require('socket.io-client');

const socket = io('http://127.0.0.1:3001');

const MATCH_ID_A = 'TEST_MATCH_ForceInject_' + Date.now();
const MATCH_ID_B = MATCH_ID_A; // SAME ID for both to ensure binding works
const HOME = 'Arsenal Test';
const AWAY = 'Liverpool Test';

socket.on('connect', () => {
    console.log('✅ Connected to Backend');

    // PHASE 1: Register matches FIRST (no odds yet) to establish bindings
    console.log('📝 Phase 1: Registering matches...');

    // Register A match
    socket.emit('endpoint_captured', {
        account: 'A',
        provider: 'BTI',
        type: 'odds_batch',
        data: [{
            matchId: MATCH_ID_A,
            home: HOME,
            away: AWAY,
            league: 'Premier League'
            // NO market/odds - just registration
        }]
    });

    // Register B match (triggers instant binding)
    setTimeout(() => {
        console.log('📝 Registering B match (CMD368)...');
        socket.emit('endpoint_captured', {
            account: 'B',
            provider: 'CMD368',
            type: 'odds_batch',
            data: [{
                matchId: MATCH_ID_B,
                home: HOME,
                away: AWAY,
                league: 'Premier League'
                // NO market/odds - just registration
            }]
        });
    }, 500);

    // PHASE 2: Send ODDS after binding is established
    setTimeout(() => {
        console.log('💉 Phase 2: Injecting Account A odds...');
        socket.emit('endpoint_captured', {
            account: 'A',
            provider: 'BTI',
            type: 'odds_batch',
            data: [{
                matchId: MATCH_ID_A,
                home: HOME,
                away: AWAY,
                league: 'Premier League',
                market: 'FT_HDP',
                selection: 'Home',
                line: '-0.50',
                odds: '1.95'
            }]
        });
    }, 1500);

    setTimeout(() => {
        console.log('💉 Injecting Account B (CMD368) odds...');
        socket.emit('endpoint_captured', {
            account: 'B',
            provider: 'CMD368',
            type: 'odds_batch',
            data: [{
                matchId: MATCH_ID_B,
                home: HOME,
                away: AWAY,
                league: 'Premier League',
                market: 'FT_HDP',
                selection: 'Away',
                line: '0.50',
                odds: '1.95'
            }]
        });
    }, 2000);

    setTimeout(() => {
        console.log('👋 Done. Check Backend Logs for [PAIR-MATCH] and Active Pairs count.');
        process.exit(0);
    }, 4000);
});
