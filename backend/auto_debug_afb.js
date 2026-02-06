// 🧪 AUTO DEBUG AFB PARSER
const { parseAfbPacket } = require('./dist/src/workers/parsers/afb-parser');

console.log('🔍 AUTO DEBUG: Testing AFB Parser...\n');

// Test data yang sesuai dengan format yang didukung
const testData = {
  "error": "",
  "js": "if(NotGuest===0){window.location.reload();} NotGuest=1;",
  "db": [{"ServerTime": "2026-02-05 15:32:44", "AccId": "15588848", "Balance": "6"}],
  "matches": [
    {
      "MatchId": "20995182",
      "HomeName": "Manchester City",
      "AwayName": "Newcastle United",
      "LeagueName": "ENGLISH PREMIER LEAGUE",
      "HomePrice": 1.85,
      "AwayPrice": 3.90,
      "market": "FT_HDP"
    },
    {
      "MatchId": "20995183",
      "HomeName": "Arsenal",
      "AwayName": "Chelsea",
      "LeagueName": "ENGLISH PREMIER LEAGUE",
      "HomePrice": 2.10,
      "AwayPrice": 3.20,
      "market": "FT_HDP"
    }
  ]
};

try {
  console.log('📤 Input data structure:');
  console.log('- Has db array:', Array.isArray(testData.db));
  console.log('- Has matches array:', Array.isArray(testData.matches));
  console.log('- Matches count:', testData.matches?.length || 0);

  const result = parseAfbPacket(testData);

  console.log('\n📊 Parser Results:');
  console.log('✅ Balance extracted:', result.balance);
  console.log('🎯 Odds extracted:', result.odds.length);

  if (result.odds.length > 0) {
    console.log('\n📋 Extracted Odds:');
    result.odds.forEach((odd, i) => {
      console.log(`   ${i+1}. ${odd.home} vs ${odd.away}`);
      console.log(`      - Selection: ${odd.selection}`);
      console.log(`      - Odds: ${odd.odds}`);
      console.log(`      - Market: ${odd.market}`);
      console.log(`      - MatchId: ${odd.matchId}`);
    });
  } else {
    console.log('❌ No odds extracted - checking why...');

    // Debug: check if matches have required fields
    testData.matches.forEach((match, i) => {
      console.log(`\n🔍 Match ${i+1} analysis:`);
      console.log(`   - HomeName: ${match.HomeName || 'MISSING'}`);
      console.log(`   - AwayName: ${match.AwayName || 'MISSING'}`);
      console.log(`   - HomePrice: ${match.HomePrice || 'MISSING'}`);
      console.log(`   - AwayPrice: ${match.AwayPrice || 'MISSING'}`);
    });
  }

} catch (error) {
  console.error('❌ Parser Error:', error.message);
  console.error('Stack:', error.stack);
}