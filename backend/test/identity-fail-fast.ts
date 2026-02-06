
import { DiscoveryService } from '../src/discovery/discovery.service';
import { NormalizationService } from '../src/normalization/normalization.service';
import { RedisService } from '../src/shared/redis.service';
import { AppGateway } from '../src/gateway.module';

// Mock dependencies
const mockNormalization = {
    generateTeamFingerprint: (name: string) => name ? name.toLowerCase().replace(/\s+/g, '') : ''
} as any;

const mockRedis = {
    getClient: () => ({
        set: async () => 'OK'
    })
} as any;

const mockGateway = {
    sendUpdate: () => { }
} as any;

async function runTest() {
    console.log("🚀 Starting Identity Fail-Fast Regression Test...");

    const discovery = new DiscoveryService(
        mockGateway,
        mockNormalization,
        mockRedis
    );

    // Initialize registries
    (discovery as any).registryA = new Map();
    (discovery as any).registryB = new Map();
    (discovery as any).eventLookup = new Map();

    const badEvent = {
        home: 'Team A',
        away: 'Team B',
        matchId: null // Missing ID
    };

    console.log("Step 1: Registering malformed event (No ID)...");
    await discovery.registerMatch('A', 'AFB88', badEvent);

    console.log("Step 2: Attempting to resolve a TOTALLY DIFFERENT ID (Expected Failure)...");
    try {
        discovery.resolveGlobalEventId('A', 'non-existent-id');
        console.error("❌ TEST FAILED: resolveGlobalEventId should have thrown an error!");
        process.exit(1);
    } catch (e) {
        if (e.message.includes("Identity Resolution Failed")) {
            console.log("✅ TEST PASSED: System correctly threw Error: " + e.message);
        } else {
            console.error("❌ TEST FAILED: Unexpected error message: " + e.message);
            process.exit(1);
        }
    }

    console.log("Step 3: Attempting to resolve an untracked ID for a registered match...");
    // Since badEvent had null ID, it should have been converted to fingerprint ID
    const fingerprint = 'teama::teamb';
    try {
        // This should SUCCEED because dummy ID logic maps null to fingerprint
        const ids = discovery.resolveGlobalEventId('A', fingerprint);
        console.log("ℹ️ Note: Dummy ID logic mapped null to " + ids[0]);
    } catch (e) {
        console.log("❌ Failed to resolve fingerprint ID: " + e.message);
    }

    console.log("🏁 Regression Test Complete.");
}

runTest().catch(err => {
    console.error("💥 Fatal Error: ", err);
    process.exit(1);
});
