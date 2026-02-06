/**
 * DEBUG SCRIPT: Live Pairing Inspector
 * 
 * Inject this into backend to see what's happening with market pairing
 */

// This is just documentation of what to look for in console logs:

/*
EXPECTED LOG FLOW:

1. [WORKER-BATCH] provider=A items=X
   → Sniffer mengirim X items dari Account A

2. [SEEKER-REGISTER] A | Provider | Home vs Away
   → Event berhasil didaftarkan

3. [MARKET-ACCEPT] GlobalID=XXXXXXXX type=FT_HDP side=Home line=0.25 odds=1.850 provider=A
   → Market berhasil dinormalisasi

4. [PAIRING-ENTRY] provider=A event=XXXXXXXX market=FT_HDP
   → Odds masuk ke PairingService

5. [STATE-BUFFER] event=XXXXXXXX provider=A oddsA=1 oddsB=0 totalEvents=X
   → Odds dari A disimpan, tapi oddsB masih 0!

6. [PAIR-REJECT] LINE_MISMATCH atau SIDE_MISMATCH
   → Pairing gagal karena line/side tidak cocok

UNTUK BERHASIL PAIR, PERLU:
- oddsA > 0 DAN oddsB > 0 di event yang SAMA
- Market type SAMA (FT_HDP vs FT_HDP)
- Side BERLAWANAN (Home vs Away untuk HDP, Over vs Under untuk OU)
- Line KOMPLEMENTER (sum=0 untuk HDP, same untuk OU)
*/

console.log("============================================");
console.log("🔍 PAIRING DEBUG GUIDE:");
console.log("============================================");
console.log("Look for these patterns in backend logs:");
console.log("");
console.log("1. [STATE-BUFFER] with oddsA>0 AND oddsB>0 = SAME EVENT HIT!");
console.log("2. [PAIR-REJECT] shows WHY pairing fails");
console.log("3. [PAIR-MATCH] shows successful complementary match");
console.log("4. [MARKET-REJECT] shows if market data is rejected before pairing");
console.log("============================================");
