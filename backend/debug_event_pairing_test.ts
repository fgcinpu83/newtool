import { DiscoveryService } from './src/discovery/discovery.service';
import { PairingService } from './src/pairing/pairing.service';
import { NormalizationService } from './src/normalization/normalization.service';
import { AppGateway } from './src/gateway.module';
import { MarketService } from './src/market/market.service';
import { RedisService } from './src/shared/redis.service';

// MOCKS
const mockGateway = {
    sendUpdate: (channel, data) => console.log(`[GW Mock] Emitted ${channel}:`, JSON.stringify(data, null, 2))
} as any;

const mockRedis = {
    getConfig: async () => ({}),
    getClient: () => ({ xadd: () => { } })
} as any;

const mockMarket = {} as any;

// SETUP
const normalization = new NormalizationService();
const discovery = new DiscoveryService(mockGateway, normalization, mockRedis);
const pairing = new PairingService(mockGateway, normalization, mockRedis);

async function runTest() {
    console.log("🧪 STARTING EVENT-LOCK PAIRING TEST");

    // 1. REGISTER MATCHES (Discovery)
    const matchA = {
        home: "Vietnam U23",
        away: "Jordan U23",
        matchId: "id_A_1",
        league: "AFC U23",
        provider: "A"
    };
    const matchB = {
        home: "Vietnam U23",
        away: "Jordan U23",
        matchId: "id_B_1",
        league: "AFC U23", // Slight diff
        provider: "B"
    };

    console.log("--- 1. REGISTERING MATCHES ---");
    discovery.registerMatch('A', 'SBO', matchA);
    discovery.registerMatch('B', 'CMD', matchB);

    // Force Seek (Simulate Interval)
    (discovery as any).runAutoSeeker();

    // Verify Loopup
    const eventIdsA = discovery.resolveGlobalEventId('A', 'id_A_1');
    const eventIdsB = discovery.resolveGlobalEventId('B', 'id_B_1');

    console.log(`Event IDs A: ${eventIdsA}`);
    console.log(`Event IDs B: ${eventIdsB}`);

    const eventIdA = eventIdsA[0];
    const eventIdB = eventIdsB[0];

    if (!eventIdA || !eventIdB || eventIdA !== eventIdB) {
        console.error("❌ FAILURE: Event IDs did not resolve or match!");
        return;
    }
    console.log("✅ SUCCESS: Matches Bound to same Global ID");

    // 2. PROCESS ODDS (Pairing)
    console.log("\n--- 2. PROCESSING ODDS ---");

    const oddsA = {
        eventId: eventIdA,
        provider: "A" as "A",
        bookmaker: "SBO",
        league: "AFC U23",
        market: "FT_HDP" as "FT_HDP",
        home: "Vietnam U23",
        away: "Jordan U23",
        odds: { selection: "Home", line: "-0.50", val: 1.95 },
        receivedAt: Date.now(),
        matchId: "id_A_1"
    };

    const oddsB = {
        eventId: eventIdB,
        provider: "B" as "B",
        bookmaker: "CMD",
        league: "AFC Cup",
        market: "FT_HDP" as "FT_HDP",
        home: "Vietnam U23",
        away: "Jordan U23",
        odds: { selection: "Away", line: "0.50", val: 1.95 }, // Matching line!
        receivedAt: Date.now(),
        matchId: "id_B_1"
    };

    pairing.processIncomingOdds(oddsA);
    pairing.processIncomingOdds(oddsB);

    // 3. NEGATIVE TEST (Garbage)
    console.log("\n--- 3. NEGATIVE TEST (Corner Market) ---");
    const garbageOdds = { ...oddsA, market: "CORNERS" as any };
    pairing.processIncomingOdds(garbageOdds); // Should log [PAIR-DROP]

}

runTest();
