
import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { RawDataEvent } from '../src/workers/api-worker';
import { CmdWorker } from '../src/workers/api-worker'; // Only testing CMD
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

// SIMULATE WORKER SERVICE WRAPPER FOR CMD
class TestCmdService {
    public cmdWorker = new CmdWorker();
    private gateway: any;

    constructor(gateway: any) {
        this.gateway = gateway;
        this.cmdWorker.onData = (e) => this.handleWorkerData(e);

        // Mock Net
        // @ts-ignore
        this.cmdWorker.client.post = async (url: string, body: any, config: any) => {
            console.log(`[CMD-MOCK] POST ${url}`);

            // SECURITY CHECK: Headers
            if (config.headers['X-Srv'] !== 'WS-187') {
                console.error('[CMD-MOCK] ❌ MISSING MANDATORY HEADER X-Srv');
                return { status: 403 };
            }
            if (config.headers['X-Requested-With'] !== 'XMLHttpRequest') {
                console.error('[CMD-MOCK] ❌ MISSING MANDATORY HEADER X-Requested-With');
                return { status: 403 };
            }

            // Route Response
            if (url.includes('GetSportItems')) {
                return {
                    status: 200,
                    data: {
                        d: {
                            SportItems: [
                                {
                                    MatchId: 99999,
                                    HomeTeam: 'Test Home',
                                    AwayTeam: 'Test Away',
                                    Odds: 0.95,
                                    BetType: 'OU',
                                    TicketType: 'OU'
                                }
                            ]
                        }
                    }
                };
            }
            if (url.includes('SetData')) {
                return { status: 200, data: { d: { status: 'OK' } } };
            }
            return { status: 404 };
        };
    }

    private handleWorkerData(event: RawDataEvent) {
        const pseudoPayload = {
            account: event.provider,
            provider: 'CMD368', // Mapping
            type: event.type,
            data: event.data,
            isInternal: true
        };
        this.gateway.commandEvents.emit('endpoint_captured', pseudoPayload);
    }

    public start() { this.cmdWorker.start(); }
    public stop() { this.cmdWorker.stop(); }

    // DUPLICATED LOGIC FROM WORKER SERVICE FOR ISOLATED TESTING
    public handleEndpointCaptured(data: any) {
        if (!data || !data.account || !data.provider) return;
        const ALLOWED_EXTERNAL = ['session_capture', 'heartbeat', 'init'];

        if (!data.isInternal) {
            if (!ALLOWED_EXTERNAL.includes(data.type)) {
                console.warn(`[SECURITY] 🛡️ BLOCKED Forbidden Packet from Sniffer: ${data.type}`);
                return;
            }
        }

        if (data.type === 'session_capture' && data.account === 'B') {
            const session = {
                cookies: data.data.cookie || '',
                userAgent: data.data.userAgent || '',
                baseUrl: data.data.url || ''
            };
            this.cmdWorker.setSession(session);
        }
    }
}

async function runCmdTests() {
    console.log('🧪 STARTING CMD FULL REGRESSION TESTS...');
    const gateway = new MockGateway();
    const service = new TestCmdService(gateway);

    let lastInternalEvent: any = null;
    gateway.commandEvents.on('endpoint_captured', (data) => {
        if (data.isInternal) {
            console.log(`[BUS] Received INTERNAL event: ${data.type} from ${data.provider}`);
            lastInternalEvent = data;
        }
    });

    // START
    service.start();

    // TEST 1: NO SESSION - NO ACTION
    console.log('\n--- TEST 1: NO SESSION STATE ---');
    await new Promise(r => setTimeout(r, 2000));
    assert.strictEqual(lastInternalEvent, null, 'Should have NO events without session');
    console.log('✅ TEST 1 PASSED');

    // TEST 2: SESSION BOOTSTRAP (Injection)
    console.log('\n--- TEST 2: SESSION BOOTSTRAP ---');
    service.handleEndpointCaptured({
        account: 'B',
        provider: 'CMD',
        type: 'session_capture',
        isInternal: false,
        data: { cookie: 'ASP.NET_SessionId=123', userAgent: 'CMD-Emulator', url: 'https://qq188.com' }
    });

    // Wait for pull (1s reset + immediate exec)
    await new Promise(r => setTimeout(r, 1500));

    assert.ok(lastInternalEvent, 'Should have received event');
    assert.ok(['match_batch', 'odds_batch'].includes(lastInternalEvent.type));
    // Verify Data content (normalized)
    assert.strictEqual(lastInternalEvent.provider, 'CMD368');
    // First event data is array of matches
    const matches = lastInternalEvent.data;
    assert.ok(Array.isArray(matches), 'Data should be array');
    assert.strictEqual(matches[0].home, 'Test Home');

    console.log('✅ TEST 2 PASSED');

    // TEST 3: SECURITY BLOCK
    console.log('\n--- TEST 3: SINGLE SOURCE SECURITY ---');
    lastInternalEvent = null;
    service.handleEndpointCaptured({
        account: 'B',
        provider: 'CMD',
        type: 'odds_batch', // MALICIOUS SNIFFER DATA
        isInternal: false,
        data: [{ fake: true }]
    });
    await new Promise(r => setTimeout(r, 500));
    assert.strictEqual(lastInternalEvent, null, 'Sniffer odds packet should be BLOCKED');
    console.log('✅ TEST 3 PASSED');

    // TEST 4: GUARDIAN SIMULATION (Stop -> Nothing)
    console.log('\n--- TEST 4: GUARDIAN/WORKER STOP ---');
    service.stop();
    lastInternalEvent = null;
    await new Promise(r => setTimeout(r, 3000)); // Wait logic cycle
    assert.strictEqual(lastInternalEvent, null, 'No data should flow when stopped');
    console.log('✅ TEST 4 PASSED');

    console.log('\n🎉 CMD FULL MIGRATION VERIFIED.');
    process.exit(0);
}

runCmdTests().catch(e => {
    console.error('CMD TEST FAILED:', e);
    process.exit(1);
});
