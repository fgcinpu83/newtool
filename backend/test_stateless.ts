import { parseSportsbookPacket } from './src/workers/parsers/sportsbook-parser';

const mockPayload = {
    Data: [
        { matchId: '123', home: 'Man United', away: 'Liverpool', odds: 1.95 },
        { matchId: '124', home: 'Arsenal', away: 'Chelsea', odds: 2.10 }
    ],
    ba: '1500.50'
};

console.log('🧪 [TEST] Running Stateless Parser Verification...');
const result = parseSportsbookPacket(mockPayload);

console.log('Result Odds Count:', result.odds.length);
console.log('Result Balance:', result.balance);

if (result.odds.length === 2 && result.balance === 1500.5) {
    console.log('✅ [TEST] PASSED: Parser correctly extracted data.');
} else {
    console.log('❌ [TEST] FAILED: Parser output incorrect.');
    console.log(JSON.stringify(result, null, 2));
}

const wrappedPayload = {
    responseBody: JSON.stringify(mockPayload)
};

console.log('\n🧪 [TEST] Running Wrapped Payload Verification...');
// Note: handleEndpointCaptured handles the wrapping now, but we test the parser logic
const result2 = parseSportsbookPacket(JSON.parse(wrappedPayload.responseBody));
if (result2.odds.length === 2) {
    console.log('✅ [TEST] PASSED: Wrapped JSON correctly parsed.');
}
