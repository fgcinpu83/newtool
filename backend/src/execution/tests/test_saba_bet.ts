import { SabaExecutionService } from '../saba-execution.service';
import { ContractRegistry } from '../../workers/contract-registry.service';

/**
 * MOCK TEST SCRIPT — Updated for ExecutionGuard v2.0
 * processBet() is now private. Test via safePlaceBet().
 * Run with: npx ts-node src/execution/tests/test_saba_bet.ts
 */
async function runTest() {
    console.log('--- SABA SAFE_PLACE_BET TEST ---');

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

    // 2. Mock Redis
    const mockRedis = {
        get: async (k: string) => {
            if (k === 'sinfo_B') return 'MOCK_SINFO_FROM_REDIS';
            return null;
        }
    } as any;

    // 3. Mock GlobalExecutionGuard (always allows)
    const mockGuard = {
        assertExecutable: () => { /* no-op = allow */ },
    } as any;

    const sabaService = new SabaExecutionService(mockRegistry, mockRedis, mockGuard);

    // 4. Mock Bet Details
    const betDetails = {
        Matchid: '119918411',
        Oddsid: '293821',
        Odds: '0.95',
        Stake: 100,
        AcceptBetterOdds: false
    };

    console.log('Testing with payload:', betDetails);

    try {
        const result = await sabaService.safePlaceBet(betDetails);
        console.log('Result:', result);
    } catch (e) {
        console.log('Expected failure (fake URL), check log formatting:');
        console.error(e.message);
    }
}

runTest();
