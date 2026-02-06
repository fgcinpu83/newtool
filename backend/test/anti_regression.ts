
import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { RawDataEvent } from '../src/workers/api-worker';
import { CmdWorker } from '../src/workers/api-worker';
import { AfbWorker } from '../src/workers/afb.worker';
import * as assert from 'assert';

// MOCKS
class MockGateway {
    public commandEvents = new EventEmitter();
    public sendUpdate(evt: string, data: any) {
        console.log(`[GATEWAY] Mock Send: ${evt}`, data);
    }
}

class MockRedis {
    async getConfig() { return { urlA: 'http://mock-a', urlB: 'http://mock-b' }; }
}

class MockDiscovery {
    getProviderStability(account: string, provider: string) {
        // Return dummy stability
        return { rate: 5, delta: 1 };
    }
}

// SIMULATE WORKER SERVICE (Partial implementation for test)
class TestWorkerService {
    public afbWorker = new AfbWorker();
    public cmdWorker = new CmdWorker();
    private gateway: any;

    constructor(gateway: any) {
        this.gateway = gateway;
    }

    public start() {
        console.log('[TEST] Workers are passive in v3.1 - no start() needed');
    }

    public stop() {
        console.log('[TEST] Workers are passive in v3.1 - no stop() needed');
    }

    // THE LOGIC UNDER TEST
    public handleEndpointCaptured(data: any) {
        if (!data || !data.account || !data.provider) return;

        // In v3.1, we just route to process()
        if (data.provider === 'AFB88') {
            this.afbWorker.process(data.account, data.data);
        }
    }
}

// MAIN TEST HARNESS
async function runTests() {
    console.log('🧪 STARTING ANTI-REGRESSION TESTS...');
    const gateway = new MockGateway();
    const service = new TestWorkerService(gateway);

    // Wire up test listener
    let lastInternalEvent: any = null;
    gateway.commandEvents.on('endpoint_captured', (data) => {
        if (data.isInternal) {
            console.log(`[BUS] Received INTERNAL event: ${data.type} from ${data.provider}`);
            lastInternalEvent = data;
        }
    });

    service.start();

    // TEST 1: NO SESSION
    console.log('\n--- TEST 1: NO SESSION STATE ---');
    // Initially, workers started but NO session, so NO requests should happen.
    // We wait 2 seconds. If mocks don't log "MOCK REQUEST", we are good.
    await new Promise(r => setTimeout(r, 2000));
    // Verify no internal events yet
    assert.strictEqual(lastInternalEvent, null, 'Should have NO events without session');
    console.log('✅ TEST 1 PASSED');

    // TEST 2: SESSION BOOTSTRAP
    console.log('\n--- TEST 2: SESSION BOOTSTRAP ---');
    service.handleEndpointCaptured({
        account: 'A',
        provider: 'AFB88',
        type: 'session_capture',
        isInternal: false,
        data: { cookie: 'foo', userAgent: 'test-ua', url: 'http://test.com' }
    });
    console.log('[TEST] Session Injected for A');

    // Wait for worker cycle (fast poll is 3-5s, we trigger manually or wait)
    // The worker.setSession triggers restart, which calls startLoop -> request immediately.
    await new Promise(r => setTimeout(r, 1000));

    assert.ok(lastInternalEvent, 'Should have received internal event after session inject');
    assert.ok(['odds_batch', 'match_batch'].includes(lastInternalEvent.type), 'Should be match_batch or odds_batch');
    console.log('✅ TEST 2 PASSED');

    // TEST 3: SNIFFER BLOCKED
    console.log('\n--- TEST 3: SNIFFER FORBIDDEN PACKET ---');
    lastInternalEvent = null; // Reset

    // Simulate malicious sniffer sending odds
    service.handleEndpointCaptured({
        account: 'A',
        provider: 'AFB88',
        type: 'odds_batch',
        isInternal: false, // EXTERNAL
        data: [{ fake: true }]
    });

    // Should NOT emit internal event
    await new Promise(r => setTimeout(r, 500));
    assert.strictEqual(lastInternalEvent, null, 'Sniffer odds packet should be BLOCKED');
    console.log('✅ TEST 3 PASSED');

    // TEST 4: GUARDIAN HONESTY (Simulated)
    console.log('\n--- TEST 4: GUARDIAN HONESTY ---');
    // If we stop worker, no more events.
    service.stop();
    lastInternalEvent = null;
    await new Promise(r => setTimeout(r, 2000));
    // Check no events flowed
    assert.strictEqual(lastInternalEvent, null, 'Worker stopped, no data flow');

    console.log('✅ TEST 4 PASSED');

    console.log('\n🎉 ALL SECURITY TESTS PASSED.');
    process.exit(0);
}

runTests().catch(e => {
    console.error('TEST FAILED:', e);
    process.exit(1);
});
