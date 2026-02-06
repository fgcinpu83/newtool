import { SabaExecutionService } from '../saba-execution.service';
import { ContractRegistry } from '../../workers/contract-registry.service';

/**
 * MOCK TEST SCRIPT
 * Run with: npx ts-node src/execution/tests/test_saba_bet.ts
 */
async function runTest() {
    console.log('--- SABA PROCESS_BET TEST ---');

    // 1. Mock Registry
    const mockRegistry = {
        getContract: (id: string) => {
            if (id === 'B:ISPORT') {
                return {
                    baseUrl: 'https://b8d6br.vpe8557.com/(S(TEST_SESSION_123))',
                    cookies: 'SESSION_ID=abc; auth=xyz',
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    headers: {
                        'Authorization': 'Bearer MOCK_TOKEN'
                    },
                    sinfo: 'SYNCED_SECURITY_HASH_FROM_REGISTRY'
                };
            }
            return null;
        }
    } as any;

    // 2. Initialize Service
    const mockRedis = {
        get: async (k: string) => {
            if (k === 'sinfo_B') return 'MOCK_SINFO_FROM_REDIS';
            return null;
        }
    } as any;

    const sabaService = new SabaExecutionService(mockRegistry, mockRedis);

    // 3. Mock Bet Details
    const betDetails = {
        Matchid: '119918411',
        Oddsid: '293821',
        Odds: '0.95',
        Stake: 100,
        // sinfo omitted to test registry fallback
        AcceptBetterOdds: false
    };

    console.log('📦 Testing with payload:', betDetails);

    try {
        // We catch the error because it will try to hit a real (but fake) URL
        // or we can mock axios if we want a pure local test.
        // For this demo, let's just see if it constructs the request correctly.
        const result = await sabaService.processBet(betDetails);
        console.log('✅ Result:', result);
    } catch (e) {
        console.log('❌ Expected hit failure (since URL is fake), but check if logs show correct formatting:');
        // console.error(e.message);
    }
}

runTest();
