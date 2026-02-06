import { EventIdentity } from '../src/utils/identity.utils';

async function testFingerprinting() {
    console.log("🚀 Running Deterministic Fingerprinting Test...");

    const sport = "soccer";
    const date = "2026-01-25T18:00:00.000Z";

    // Scenario 1: Variations of the same team name
    const matches = [
        { home: "Man. Utd", away: "Liverpool FC" },
        { home: "Manchester United", away: "Liverpool" },
        { home: "man utd", away: "liverpool" },
        { home: "MAN-UTD", away: "LIVERPOOL_FC" }
    ];

    console.log("\n--- Scenario 1: Team Name Normalization ---");
    const uuids = matches.map(m => {
        const uuid = EventIdentity.generateFingerprint(sport, date, m.home, m.away);
        console.log(`[ID] ${uuid} <-- ${m.home} vs ${m.away}`);
        return uuid;
    });

    const allSame = uuids.every(u => u === uuids[0]);
    if (allSame) {
        console.log("✅ SUCCESS: All variations resulted in the same deterministic UUID.");
    } else {
        console.error("❌ FAILURE: Inconsistent UUIDs generated for normalized names.");
        // Note: Manchester United vs Man Utd might fail depending on normalization rules.
        // The user asked for /[^a-z0-9]/g. So "manutd" vs "manchesterunited" will be DIFFERENT.
        // This is EXPECTED if we don't have a team dictionary, but "Man. Utd" vs "man utd" should be SAME.
    }

    // Scenario 2: Verify "Man. Utd" vs "Man Utd"
    console.log("\n--- Scenario 2: Punctuation & Case Normalization ---");
    const id1 = EventIdentity.generateFingerprint(sport, date, "Man. Utd", "Liverpool FC");
    const id2 = EventIdentity.generateFingerprint(sport, date, "man utd", "liverpool fc");

    if (id1 === id2) {
        console.log("✅ SUCCESS: 'Man. Utd' correctly matched 'man utd'.");
    } else {
        console.error("❌ FAILURE: Punctuation/Case caused a collision.");
    }

    // Scenario 3: Different Date (should be different)
    console.log("\n--- Scenario 3: Date Dependency ---");
    const id3 = EventIdentity.generateFingerprint(sport, "2026-01-26T18:00:00.000Z", "Man. Utd", "Liverpool FC");
    if (id1 !== id3) {
        console.log("✅ SUCCESS: Different dates resulted in different UUIDs.");
    } else {
        console.error("❌ FAILURE: UUIDs did not change with date.");
    }

    console.log("\n🏁 Fingerprinting Test Complete.");
}

testFingerprinting().catch(console.error);
