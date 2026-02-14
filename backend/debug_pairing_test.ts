
import { Test, TestingModule } from '@nestjs/testing';
import { PairingService, RawOdds } from './src/pairing/pairing.service';
import { AppGateway } from './src/gateway.module';
import { NormalizationService } from './src/normalization/normalization.service';

// MOCK DEPENDENCIES
const mockGateway = {
    sendUpdate: (event: string, data: any) => {
        console.log(`[GW Mock] Emitted ${event}:`, JSON.stringify(data, null, 2));
    }
};

const mockNormalization = {
    normalize: (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
};

const mockRedisService = {
    getConfig: async () => ({
        minProfit: 0.5,
        min: 0.5,
        max: 5.0,
        tiers: { t1: { amount: 500 } }
    })
};

async function runTest() {
    console.log("🚀 STARTING PAIRING ENGINE AUDIT...");

    // 1. Setup Service
    const mockCommandRouter = { register: (cmd: string, handler: any) => {} } as any;
    const service = new PairingService(mockGateway as any, mockNormalization as any, mockRedisService as any, mockCommandRouter);
    service.onModuleInit();

    // 2. Define Test Cases
    const oddsA1: RawOdds = {
        provider: 'A',
        bookmaker: 'SBO',
        league: 'English Premier League',
        market: 'FT_HDP',
        home: 'Manchester City',
        away: 'Liverpool',
        odds: { val: 0.95, selection: 'Home', line: '-0.5' },
        receivedAt: Date.now(),
        matchId: '1'
    };

    const oddsB1: RawOdds = {
        provider: 'B',
        bookmaker: 'CMD',
        league: 'EPL', // Different league name
        market: 'FT_HDP',
        home: 'Man City', // Different name
        away: 'Liverpool FC', // Different name
        odds: { val: 0.98, selection: 'Away', line: '0.5' },
        receivedAt: Date.now(),
        matchId: '2'
    };

    const oddsA2: RawOdds = {
        provider: 'A',
        bookmaker: 'SBO',
        league: 'Serie A',
        market: 'FT_OU',
        home: 'Juventus',
        away: 'AC Milan',
        odds: { val: 1.90, selection: 'Over', line: '2.5' },
        receivedAt: Date.now(),
        matchId: '3'
    };

    const oddsB2: RawOdds = {
        provider: 'B',
        bookmaker: 'CMD',
        league: 'Italy Serie A',
        market: 'FT_OU',
        home: 'Juventus FC',
        away: 'Milan',
        odds: { val: 1.85, selection: 'Under', line: '2.5' },
        receivedAt: Date.now(),
        matchId: '4'
    };

    const garbageA: RawOdds = {
        provider: 'A',
        bookmaker: 'SBO',
        league: 'Unknown',
        market: 'FT_HDP',
        home: 'Corner Kick 1',
        away: 'Corner Kick 2',
        odds: { val: 1.0, selection: 'H', line: '0' },
        receivedAt: Date.now(),
        matchId: '5'
    };

    // 3. Execution Phase
    console.log("\n🧪 TEST 1: Fuzzy Match (Man City vs Liverpool incl. League Dif)");
    service.processIncomingOdds(oddsA1);
    service.processIncomingOdds(oddsB1);

    console.log("\n🧪 TEST 2: Fuzzy Match (Juve vs Milan)");
    service.processIncomingOdds(oddsA2);
    // Introduce slight delay/time diff simulation
    oddsB2.startTime = Date.now() + 60000;
    oddsA2.startTime = Date.now();
    service.processIncomingOdds(oddsB2);

    console.log("\n🧪 TEST 3: Garbage/No Match");
    service.processIncomingOdds(garbageA);
    // No B counterpart
}

runTest();
