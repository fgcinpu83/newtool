// 🔒 ARCHITECTURE GATE
// Governed by:
// - ARSITEKTUR_FINAL.md (Constitution)
// - provider_arsitek.md (Operational Law)
// Any logic here must map to a registered Provider Profile.
// Unauthorized behavior is an architectural violation.
// ============================================================

import { Injectable, OnModuleInit, Logger, Scope, Inject, forwardRef } from '@nestjs/common';
import { parseSportsbookPacket } from './parsers/sportsbook-parser';
import { parseAfbPacket } from './parsers/afb-parser';
import { PROVIDERS } from '../shared/provider.architecture';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AppGateway } from '../gateway.module';
import { MarketService } from '../market/market.service';
import { RedisService } from '../shared/redis.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { PairingService, RawOdds } from '../pairing/pairing.service';
import { ProviderGuardianService } from '../guardian/provider-guardian.service';
import { ContractRegistry, SportsbookContract } from './contract-registry.service';
import { UniversalDecoderService } from '../shared/decoder.service';
import { parseProvider } from '../contracts';
import { EventIdentity } from '../utils/identity.utils';
import { SystemConfig, ProviderType, getAccountForProvider, detectProviderFromUrl } from '../providers/account-binding.config';

// ðŸ”¥ PROVIDER STATE MACHINE
// Expanded to include Guardian states
export type ProviderState = 'INACTIVE' | 'SESSION_BOUND' | 'LIVE' | 'IDLE' | 'RECOVERING' | 'DEAD' | 'HEARTBEAT_ONLY' | 'NO_DATA';

interface ProviderEntry {
    name: string;
    account: string;
    state: ProviderState;
    lastSeen: number;
    sessionBoundAt?: number;  // When it transitioned to SESSION_BOUND
}


const ISPORT_DOMAINS = ['lvx3306', 'aro0061', 'qq188best', 'vpe8557', 'processbet', 'aro', 'msy', 'mgf'];

@Injectable()
export class WorkerService implements OnModuleInit {
    private readonly logger = new Logger(WorkerService.name);
    private readonly instanceId = Math.random().toString(36).substring(7);

    private isRunning = true;

    private wireLogDir = path.join(process.cwd(), 'logs');
    private wireLog = path.join(this.wireLogDir, 'wire_debug.log');

    // ðŸ”¥ PROVIDER STATUS
    private providerStatus: Record<string, ProviderState> = {
        A1: 'INACTIVE', A2: 'INACTIVE', A3: 'INACTIVE', A4: 'INACTIVE', A5: 'INACTIVE',
        B1: 'INACTIVE', B2: 'INACTIVE', B3: 'INACTIVE', B4: 'INACTIVE', B5: 'INACTIVE'
    };
    private balance: Record<string, string> = { A: '0.00', B: '0.00' };
    private capturedEndpoints: Map<string, any> = new Map();

    // 🔥 MULTI-PROVIDER REGISTRY with State Machine
    private providerRegistry: Map<string, ProviderEntry> = new Map();
    private bornProviders: Set<string> = new Set(); // 🛡️ v3.1 Deterministic Birth Tracking
    private providerSlots: Record<string, string[]> = { A: [], B: [] };
    private tabToAccountMap: Map<string, 'A' | 'B'> = new Map(); // 🛰️ v3.2: Dynamic Tab Binding
    private lastOpenedAccount: string | null = null;
    private lastOpenedTime: number = 0;

    // 🛡️ v6.2 PIPELINE LIFECYCLE TRACKING
    private pipelineStage: Record<string, string> = {
        A: 'BROWSER_INIT',
        B: 'BROWSER_INIT'
    };

    private config = {
        urlA: '',
        urlB: '',
        accountA_active: false,
        accountB_active: false
    };
    
    // 🎯 v10.0: SystemConfig cache for config-driven routing
    private systemConfigCache: SystemConfig | null = null;
    private systemConfigCacheTime = 0;
    private readonly SYSTEM_CONFIG_TTL = 5000; // 5 seconds

    constructor(
        @Inject(forwardRef(() => MarketService))
        private marketService: MarketService,
        private gateway: AppGateway,
        private redisService: RedisService,
        private discoveryService: DiscoveryService,
        private pairingService: PairingService,
        private guardianService: ProviderGuardianService,
        private registry: ContractRegistry,
        private decoder: UniversalDecoderService
    ) {
        // Subscription to Registry for ORCHESTRATION is now handled dynamically in orchestrateWorker

        // Initialize without worker subscriptions
    }

    async onModuleInit() {
        if (!fs.existsSync(this.wireLogDir)) fs.mkdirSync(this.wireLogDir, { recursive: true });
        this.logger.log(`🏗️ WorkerService v3.1 INITIALIZED (InstanceID: ${this.instanceId})`);
        
        // 🛡️ v11.0: ALWAYS start with accounts OFF and balance 0
        // Do NOT load from Redis - fresh start every time
        this.config = {
            urlA: '',
            urlB: '',
            accountA_active: false,
            accountB_active: false
        };
        this.balance = { A: '0.00', B: '0.00' };
        
        // Clear Redis config on startup to ensure clean state
        await this.redisService.setConfig(this.config);
        
        this.broadcastStatus();

        // 🚀 v9.8: Operation Full Sync (Start AFB & ISPORT Parallel)
        Promise.all([
            this.runProviderJob('AFB88'),
            this.runProviderJob('ISPORT')
        ]).catch(e => console.error(`[SYNC-ERR] Parallel start failed: ${e.message}`));

        // Workers are now started dynamically

        // ðŸ”¥ LISTEN FOR DATA (LEGACY + SESSION)
        this.gateway.commandEvents.on('endpoint_captured', (data) => {
            this.handleEndpointCaptured(data);
        });

        console.log('[WORKER] Now listening for endpoint_captured events');

        // ðŸ”¥ SYNC CONFIG 
        // 🔒 v3.1 FIX: SINGLE AUTHORITY FOR TOGGLE_ACCOUNT
        this.gateway.commandEvents.on('command', async (data) => {
            if (data.type === 'TOGGLE_ACCOUNT') {
                const { account, active } = data.payload;

                console.log(`[WORKER] 🔄 TOGGLE_ACCOUNT: ${account} -> ${active ? 'ON' : 'OFF'}`);

                // 1. Update local state
                if (account === 'A') {
                    this.config.accountA_active = active;
                    if (!active) this.resetAccount('A');
                }
                if (account === 'B') {
                    this.config.accountB_active = active;
                    if (!active) this.resetAccount('B');
                }

                // 2. Sync to Redis immediately
                try {
                    await this.redisService.setConfig(this.config);
                    console.log(`[WORKER] ✅ Config synced to Redis: ${account}_active=${active}`);
                } catch (e) {
                    console.error('[WORKER] ⚠️ Redis sync failed, using local config');
                }

                // 3. Broadcast status
                this.broadcastStatus();

                // NOTE: Browser open/close is handled by frontend + BrowserAutomation
                // 🚀 v9.8: PARALEL MURNI (Operation Full Sync)
                if (active) {
                    this.triggerParallelLaunch(account);
                }
            }

            else if (data.type === 'UPDATE_CONFIG') {
                this.config = { ...this.config, ...data.payload };
                try {
                    await this.redisService.setConfig(this.config);
                } catch (e) { }
                this.broadcastStatus();
            }
            else if (data.type === 'FORCE_LAUNCH') {
                console.log('🚀 [WORKER] FORCE_LAUNCH detected. BrowserAutomation will handle execution.');
            }
            else if (data.type === 'FORCE_RESET') {
                console.log('🚨 [FORCE-RESET] Wiping discovery registries and resetting events count.');
                this.discoveryService.clearAllMemory();
                this.gateway.sendUpdate('system_log', {
                    level: 'warn',
                    message: '[SYSTEM] Discovery registry wiped. Awaiting fresh data pulses.'
                });
            }
            else if (data.type === 'RELOAD_EXTENSION' || data.type === 'RELOAD_TAB') {
                console.log('🚨 [RELOAD-PROTOCOL] Forcing extension reload on all browser tabs.');
                this.gateway.emitBrowserCommand('A', 'RELOAD_EXTENSION');
                this.gateway.emitBrowserCommand('B', 'RELOAD_EXTENSION');
            }
            else if (data.type === 'PANIC_STOP') {
                this.emergencyStop();
            }
            // 🛡️ v11.0: OPEN_BROWSER is now ONLY handled by BrowserAutomationService
            // Worker just tracks state for status updates
            else if (data.type === 'OPEN_BROWSER') {
                const { account } = data.payload;
                this.pipelineStage[account] = 'BROWSER_INIT';
                console.log(`[WORKER] 📍 Browser command received for Account ${account} (handled by BrowserAutomation)`);
            }
            else if (data.type === 'FORCE_ACTIVATE') {
                const connCount = (this.gateway.server as any)?.clients?.size || 0;
                const msg = `[WORKER] 🚀 FORCE_RECOVERY: Sending ACTIVATE_MARKET_AUTO (Conns: ${connCount})`;
                console.log(msg);
                try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
                this.gateway.sendUpdate('browser:command', { command: 'ACTIVATE_MARKET_AUTO', account: 'ALL' });
            }
            else if (data.type === 'ENABLE_DEBUG') {
                const msg = `[WORKER] 🐞 DEBUG MODE ENABLED (60s)`;
                console.log(msg);
                try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
                (this as any).tempDebug = true;
                setTimeout(() => {
                    (this as any).tempDebug = false;
                    const msgOff = `[WORKER] 🐞 DEBUG MODE DISABLED`;
                    console.log(msgOff);
                    try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msgOff}\n`); } catch (e) { }
                }, 60000);
            }
            else if (data.type === 'FLUSH_REGISTRY_B') {
                console.log('🧹 [GARBAGE-PURGE] Flushing Registry B...');
                this.discoveryService.flushRegistryB();
            }
            else if (data.type === 'HARD_RECOVERY') {
                console.log('🚨 [HARD-RECOVERY] Executing memory purge and fresh pull...');
                this.discoveryService.clearAllMemory();
                this.resetAccount('A');
                this.resetAccount('B');

                // Trigger fresh pulls
                this.gateway.sendUpdate('browser:command', { command: 'ACTIVATE_MARKET_AUTO', account: 'ALL' });

                // Trigger Balance Scrape via DOM
                const scrapeScript = `
                    (function() {
                        try {
                            // AFB88 Balance Scrape
                            const afbBal = document.querySelector('.balance-amount')?.innerText || 
                                         document.querySelector('#balance2D')?.innerText;
                            // ISPORT Balance Scrape
                            const isportBal = document.querySelector('#spanBalance')?.innerText || 
                                           document.querySelector('.balance-text')?.innerText;
                            
                            const balance = afbBal || isportBal;
                            if (balance) {
                                console.log('[EXT-SCRAPE] Found balance:', balance);
                                // This would normally be sent via sniffer
                            }
                        } catch(e) {}
                    })()
                `;
                this.gateway.sendUpdate('browser:command', { command: 'EXECUTE_SCRIPT', script: scrapeScript });

                this.gateway.sendUpdate('system_log', { level: 'info', message: '🚀 Hard Recovery: Registries purged, re-syncing from browsers...' });
            }
            else if (data.type === 'BYPASS_FILTERS') {
                const msg = `[WORKER] 🔓 FILTER BYPASS ENABLED (600s)`;
                console.log(msg);
                try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
                this.discoveryService.setBypass(true);
                setTimeout(() => {
                    this.discoveryService.setBypass(false);
                    const msgOff = `[WORKER] 🔒 FILTER BYPASS DISABLED`;
                    console.log(msgOff);
                    try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msgOff}\n`); } catch (e) { }
                }, 600000);
            }
        });
    }


    @Cron(CronExpression.EVERY_5_SECONDS)
    runStatusSync() {
        const connCount = (this.gateway.server as any)?.clients?.size || 0;
        const msg = `[STATUS-SYNC] ID=${this.instanceId} PID=${process.pid} Heartbeat (Conns: ${connCount})`;
        try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }

        // 🕵️ v3.2 Account B Forensic
        const bCont = this.registry.getContract('B:ISPORT');
        const bReg = this.providerRegistry.get('B:ISPORT');
        const bSlot = this.providerSlots.B[0]; // Assume slot 1
        const diag = `[v3.2-B-DIAG] Cont=${!!bCont} Reg=${!!bReg} Slot=${bSlot} Born=${this.bornProviders.has('B:ISPORT')}`;
        try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${diag}\n`); } catch (e) { }

        // 🔥 v3.5.7 Pipeline Health Check
        const stats = this.discoveryService.getStats();
        const totalEvents = stats.registryASize + stats.registryBSize;

        if (totalEvents === 0) {
            // 🛡️ v4.5 Enhanced Diagnostics
            const tabCount = this.tabToAccountMap.size;
            const bornCount = this.bornProviders.size;
            const bornList = Array.from(this.bornProviders).join(', ') || 'NONE';

            let recommendation = '';
            if (connCount === 0) {
                recommendation = 'Load browser extension!';
            } else if (tabCount === 0) {
                recommendation = 'Open betting sites & login!';
            } else if (bornCount === 0) {
                recommendation = 'Navigate to Football/Sportsbook!';
            } else {
                recommendation = 'FILTER REJECT: Ensure you are in Soccer (Real), not Virtual/E-sports!';
            }

            this.gateway.sendUpdate('system_log', {
                level: 'error',
                message: `[PIPE-EMPTY] Conns=${connCount} | Tabs=${tabCount} | Born=[${bornList}] | Registry=0. ${recommendation}`
            });

            // Log to file for debugging
            const diagMsg = `[PIPE-EMPTY-DIAG] Conns=${connCount} Tabs=${tabCount} Born=${bornCount} (${bornList}) A_active=${this.config.accountA_active} B_active=${this.config.accountB_active}`;
            try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${diagMsg}\n`); } catch (e) { }
        } else {
            // 🔥 v6.1 PIPE-FLOWING: Data is present!
            const tabCount = this.tabToAccountMap.size;
            const bornList = Array.from(this.bornProviders).join(', ') || 'NONE';

            this.gateway.sendUpdate('system_log', {
                level: 'info',
                message: `[PIPE-FLOWING] ✅ Conns=${connCount} | Tabs=${tabCount} | Born=[${bornList}] | RegA=${stats.registryASize} | RegB=${stats.registryBSize} | Pairs=${stats.confirmedPairs}`
            });

            // Log to file
            const flowMsg = `[PIPE-FLOWING] A=${stats.registryASize} B=${stats.registryBSize} Pairs=${stats.confirmedPairs}`;
            try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${flowMsg}\n`); } catch (e) { }
        }
        // 🛡️ v5.2: Removed spammy "Balance A is 0.00" log - no longer needed every 5 seconds

        this.broadcastStatus();
    }

    public getAllProviderStatuses() {
        return this.providerStatus;
    }


    public getBornCount() {
        return this.bornProviders.size;
    }

    // 🔥 CORE: Handle incoming sniffer data OR Mobile Worker Data
    async handleEndpointCaptured(data: any) {
        try {
            if (!data || !data.account) return;

            // 🔍 Diagnostic: Raw Payload Logging (v3.2)
            const account0 = String(data.account).trim().toUpperCase();
            const payloadLen = JSON.stringify(data).length;
            const rawMsg = `[RAW-INGEST] 📥 Ingested from ${account0}: ${(payloadLen / 1024).toFixed(2)} KB | type=${(data.type || '').toLowerCase()}`;
            console.log(rawMsg);
            try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${rawMsg}\n`); } catch (e) { }

            const type = (data.type || '').toLowerCase();
            const url = (data.data?.url || data.url || '').toLowerCase();
            let account = String(data.account).trim().toUpperCase();

            // --- SINFO CAPTURE: sniff security token if present and store in Redis for this account
            try {
                let sinfoVal: string | undefined;
                const bodyCandidate = data.data?.body || data.responseBody || data.data || data.body || data;
                // direct fields
                sinfoVal = data.sinfo || data.data?.sinfo || (bodyCandidate && bodyCandidate.sinfo) || undefined;
                // if responseBody is a string, try JSON parse and fallback to regex
                if (!sinfoVal && typeof data.responseBody === 'string') {
                    try { const parsed = JSON.parse(data.responseBody); sinfoVal = parsed?.sinfo || parsed?.SINFO || undefined; } catch (e) { }
                    if (!sinfoVal) {
                        const m = String(data.responseBody).match(/sinfo=([^&"'\s]+)/i);
                        if (m) sinfoVal = m[1];
                    }
                }
                // URL query param
                if (!sinfoVal && data.url) {
                    try { const u = new URL(data.url); sinfoVal = u.searchParams.get('sinfo') || undefined; } catch (e) { }
                }

                if (sinfoVal) {
                    try {
                        await this.redisService.set(`sinfo_${account}`, sinfoVal, 300); // short TTL 5m
                        const msg = `[SINFO-CAPTURE] account=${account} sinfo=${String(sinfoVal).substring(0,8)}...`;
                        console.log(msg);
                        try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
                    } catch (e) { /* ignore redis errors */ }
                }
            } catch (e) { /* non-fatal */ }
            
            // 🛡️ v9.6: Skip local WebSocket traffic (this is just the transport, not actual data)
            if (url.includes('localhost:8080') || url.includes('127.0.0.1:8080')) {
                // Check if there's a meaningful frameUrl
                const frameUrl = (data.frameUrl || data.data?.frameUrl || '').toLowerCase();
                if (frameUrl && !frameUrl.includes('localhost') && !frameUrl.includes('127.0.0.1')) {
                    // Use frameUrl for processing instead
                    data.url = frameUrl;
                    data.data = data.data || {};
                    data.data.url = frameUrl;
                } else {
                    // Skip this noise traffic
                    return;
                }
            }

            if (type === 'lifecycle_signal') {
                const stage = data.stage;
                const providerHint = data.provider;
                if (account === 'DESKTOP') {
                    // v9.8: Correct mapping - ISPORT=A, AFB88=B
                    if (providerHint === 'ISPORT' || providerHint === 'SABA') account = 'A';
                    else if (providerHint === 'AFB88') account = 'B';
                }

                if (account === 'A' || account === 'B') {
                    this.pipelineStage[account] = stage;
                    const sigMsg = `[LIFECYCLE] 🛡️ Account ${account} reached stage: ${stage} (${providerHint || 'Searching...'})`;
                    console.log(sigMsg);
                    try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${sigMsg}\n`); } catch (e) { }
                    this.broadcastStatus();
                }
                return;
            }

            if (type === 'debug_log') {
                const color = (data.account === 'B' || data.provider === 'ISPORT') ? '\x1b[33m' : '\x1b[32m';
                console.log(`${color}[BROWSER-LOG][${data.account || 'EXT'}] ${data.message}\x1b[0m`);
                return;
            }

            let verifiedProvider = this.classifyContract(url, data.data || data, type);

            // 🎯 v10.0 CONFIG-DRIVEN ROUTING (TIDAK HARDCODE)
            // Route traffic ke account berdasarkan USER CONFIG, bukan hardcode
            const systemConfig = await this.getSystemConfig();
            
            if (verifiedProvider === 'ISPORT' || verifiedProvider === 'SABA') {
                // Lookup: Provider SABA di-assign ke account mana?
                const targetAccount = getAccountForProvider(systemConfig, 'SABA');
                if (targetAccount) {
                    const oldAcc = String(data.account).toUpperCase();
                    if (oldAcc !== targetAccount) {
                        console.log(`[v10.0-CONFIG] 🎯 Routed SABA/ISPORT to Account ${targetAccount} (was: ${oldAcc}): ${url.substring(0, 40)}`);
                    }
                    account = targetAccount;
                }
            } else if (verifiedProvider === 'AFB88') {
                // Lookup: Provider AFB88 di-assign ke account mana?
                const targetAccount = getAccountForProvider(systemConfig, 'AFB88');
                if (targetAccount) {
                    const oldAcc = String(data.account).toUpperCase();
                    if (oldAcc !== targetAccount) {
                        console.log(`[v10.0-CONFIG] 🎯 Routed AFB88 to Account ${targetAccount} (was: ${oldAcc}): ${url.substring(0, 40)}`);
                    }
                    account = targetAccount;
                }
            }
            
            // Also check URL patterns if account still DESKTOP
            if (account === 'DESKTOP') {
                const frameUrl = (data.frameUrl || '').toLowerCase();
                const urlForDetection = frameUrl.length > url.length ? frameUrl : url;
                
                // Detect provider dari URL
                const detectedProvider = detectProviderFromUrl(urlForDetection);
                if (detectedProvider !== 'UNASSIGNED') {
                    verifiedProvider = detectedProvider === 'SABA' ? 'ISPORT' : detectedProvider;
                    
                    // Route ke account berdasarkan config
                    const targetAccount = getAccountForProvider(systemConfig, detectedProvider);
                    if (targetAccount) {
                        account = targetAccount;
                    }
                }
            }

            // 🔥 v3.2 [FIX]: Trust internal identity
            if (!verifiedProvider && (data.account === 'B' || data.isInternal && data.provider === 'ISPORT')) {
                verifiedProvider = 'ISPORT';
            }

            if (account === 'B' || verifiedProvider === 'ISPORT') {
                console.log(`\x1b[35m[DEBUG-ISPORT] 🔍 ISPORT DATA RECEIVED | Type: ${type} | Account: ${account}\x1b[0m`);
            }

            if (!verifiedProvider) {
                // 🔍 v3.2 Deep Packet Inspection (Account B Recovery)
                const isPotentialB = data.account === 'B' || ISPORT_DOMAINS.some(d => url.includes(d));
                if (isPotentialB && (type === 'api_contract_capture' || type === 'api_contract_recorder')) {
                    const inspection = parseSportsbookPacket(data.data || data);
                    if (inspection.odds.length > 0 || inspection.balance !== null) {
                        verifiedProvider = 'ISPORT';
                        const msg = `[v3.2] 🕵️ DPI Success: Recovered ${verifiedProvider} from raw payload`;
                        console.log(msg);
                        try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
                    } else if (!verifiedProvider && (url.includes('aro0061') || url.includes('msy') || url.includes('mgf'))) {
                        // 🛰️ v3.2 Recovery: Force ISPORT birth on known SABA hosts even for chatty/unknown packets
                        verifiedProvider = 'ISPORT';
                        const msg = `[v3.2] 🐣 Discovery Recovery: Forced ISPORT on known SABA host: ${url.substring(0, 50)}`;
                        console.log(msg);
                        try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
                    }
                }

                if (!verifiedProvider) {
                    // [v3.1] Drop and log only if potentially relevant
                    if (!this.isNoise(url) || (this as any).tempDebug) {
                        const dropMsg = `[CLASSIFIER] 🔍 Dropped undetectable traffic: ${url.substring(0, 100)}`;
                        console.log(dropMsg);

                        // 🛡️ v4.0 AUTO-DISCOVERY (FALLBACK FROM WORKER-MANAGER)
                        // If traffic is undetectable, check if it looks like substantive match data
                        const payload = await this.decoder.decode(data.data || data);
                        if (payload) {
                            const { confidence, reason } = this.decoder.getMatchDataConfidence(payload);
                            if (confidence >= 70) {
                                const discMsg = `[DISCOVERY-SRV] 🕵️ UNKNOWN DATA DETECTED (Confidence: ${confidence}% | ${reason}) URL=${url.substring(0, 50)}`;
                                console.log(discMsg);
                                try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${discMsg}\n`); } catch (e) { }

                                this.gateway.sendUpdate('UNKNOWN_PROVIDER_DATA', {
                                    url: url,
                                    account: account,
                                    confidence: confidence,
                                    reason: reason,
                                    sample: typeof payload === 'object' ?
                                        JSON.stringify(payload).substring(0, 500) :
                                        String(payload).substring(0, 500),
                                    timestamp: Date.now()
                                });
                            }
                        }

                        if ((this as any).tempDebug) {
                            try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] [DEBUG-DROP] ${url} PACKET=${JSON.stringify(data).substring(0, 500)}\n`); } catch (e) { }
                        }
                        if (data.account === 'B' || url.includes('qq188')) {
                            console.log(`[v3.2-B-AUDIT] Rejecting potential B traffic: ${url.substring(0, 100)} type=${type}`);
                        }
                    }
                    return;
                }
            }

            // TRACE: Identification Success
            if (account === 'B' || verifiedProvider === 'ISPORT') {
                const idMsg = `[v3.2-B-OK] Identified ${verifiedProvider} for Account ${account} type=${type}`;
                console.log(idMsg);

                // 🕵️ TRACE_AUDIT INJECTION
                console.log('[TRACE_AUDIT][LEVEL:PROVIDER] Raw Data received:', JSON.stringify({
                    packet_id: data.rawId || 'stream_chunk',
                    type: type,
                    timestamp: Date.now(),
                    url: url.substring(0, 50)
                }));

                try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${idMsg}\n`); } catch (e) { }
            }

            // 🎯 UNIVERSAL SLOTTING ARCHITECTURE (Dynamic A/B Routing)
            // 🛡️ v9.6 FIX: Don't re-assign account - it was already set correctly above
            // account = String(data.account).trim().toUpperCase(); // REMOVED - causes override of correct mapping
            const tabId = data.tabId || data.data?.tabId;

            if (account === 'DESKTOP') {
                let mapped = false;

                // Phase 1: Whitelabel Host Matching
                try {
                    const currentHost = new URL(url).hostname.toLowerCase();
                    const aHost = this.config.urlA ? new URL(this.config.urlA).hostname.toLowerCase() : null;
                    const bHost = this.config.urlB ? new URL(this.config.urlB).hostname.toLowerCase() : null;

                    // AFB88 / SABA WS ALIASES (v3.2)
                    const afb88Aliases = ['prosportslive.net', 'wsfev2.net', 'jps9.com', 'mpo1221', 'linkcdn', 'jps9', 'growingjadeplant'];
                    const isAfb88Domain = afb88Aliases.some(alias => currentHost.includes(alias));

                    if (aHost && currentHost.includes(aHost)) {
                        account = 'A';
                        mapped = true;
                    } else if (bHost && currentHost.includes(bHost)) {
                        account = 'B';
                        mapped = true;
                    } else if (isAfb88Domain) {
                        // Domain belongs to AFB88, but whitelabel doesn't match host. 
                        // This is common for WebSockets. We'll rely on Phase 2 or 4.
                    }
                } catch (e) { }

                // Phase 2: Follow Tab Binding
                if (!mapped && tabId) {
                    const boundAccount = this.tabToAccountMap.get(String(tabId));
                    if (boundAccount) {
                        account = boundAccount;
                        mapped = true;
                    }
                }

                // Phase 3: Single Active Account Fallback
                if (!mapped) {
                    const aActive = this.config.accountA_active;
                    const bActive = this.config.accountB_active;
                    if (aActive && !bActive) {
                        account = 'A';
                        mapped = true;
                    } else if (bActive && !aActive) {
                        account = 'B';
                        mapped = true;
                    }
                }

                // 🎯 Phase 4: Learning Phase (v3.2)
                // If still unmapped but we recently opened a browser for a specific account, BIND IT.
                if (!mapped && tabId && this.lastOpenedAccount) {
                    account = this.lastOpenedAccount;
                    this.tabToAccountMap.set(String(tabId), account as 'A' | 'B');
                    mapped = true;
                    const learnMsg = `[MAPPING] 🎓 Tab Learned: ${tabId} bound to Account ${account}`;
                    console.log(learnMsg);
                    try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${learnMsg}\n`); } catch (e) { }
                }

                // 🎯 Phase 5: Config-Driven Pinning (v10.0)
                // Use config to determine account for provider
                if (!mapped && verifiedProvider) {
                    const providerType = (verifiedProvider === 'ISPORT' ? 'SABA' : verifiedProvider) as ProviderType;
                    const targetAccount = getAccountForProvider(systemConfig, providerType);
                    if (targetAccount) {
                        account = targetAccount;
                        mapped = true;
                        
                        if (tabId) {
                            this.tabToAccountMap.set(String(tabId), account as 'A' | 'B');
                        }
                    }
                }

                if (mapped) {
                    const mMsg = `[MAPPING] 🖇️ ${verifiedProvider} -> Account ${account} (via CONFIG)`;
                    console.log(mMsg);
                    try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${mMsg} URL=${url.substring(0, 40)}\n`); } catch (e) { }
                }
            }

            if (tabId && (account === 'A' || account === 'B')) {
                this.tabToAccountMap.set(String(tabId), account as 'A' | 'B');
            }

            const logMsgPrefix = `[v3.2] ${account}:${verifiedProvider} (${type})`;
            if (type !== 'heartbeat') {
                try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${logMsgPrefix} URL=${url.substring(0, 50)}\n`); } catch (e) { }
            }

            const handleTimestamp = Date.now();

            // 🛡️ v4.6 OVERDRIVE: Log data arrival summary
            // 🛡️ v7.5 DETERSMINISTIC CLIENT TRACE
            console.log(`[RAW-RECEIVE] ${account}/${verifiedProvider} | TYPE=${type} | CID=${data.clientId || 'default'} | URL=${url.substring(0, 40)}`);

            // ===============================
            //  ACCOUNT ACTIVE GATE (BYPASSED IN OVERDRIVE)
            // ===============================
            const accountActive = true; // 🛡️ v4.4: Force TRUE to see all data

            const logMsg = `[v3.1] Raw Packet Received -> [CLASSIFIER] ${verifiedProvider} Identified`;
            console.log(logMsg);
            const ts = new Date().toISOString();
            try { fs.appendFileSync(this.wireLog, `[${ts}] ${logMsg}\n`); } catch (e) { }

            const regKey = `${account}:${verifiedProvider}`;

            // 🛡️ v4.7 EARLY BIRTH: Born by URL before any gate
            if (!this.bornProviders.has(regKey)) {
                const lowerUrl = url.toLowerCase();
                const isSportUrl = lowerUrl.includes('aro') || lowerUrl.includes('msy') || lowerUrl.includes('qq188') || lowerUrl.includes('saba') || lowerUrl.includes('afb');
                if (isSportUrl || type === 'session_capture' || type === 'api_contract_capture' || type === 'api_contract_recorder') {
                    this.markProviderBorn(account, verifiedProvider);
                }
            }

            if (type === 'api_contract_capture' || type === 'api_contract_recorder' || type === 'session_capture' || type === 'contract_audit') {
                const contractData: any = {
                    baseUrl: url,
                    cookies: data.data?.cookies || data.cookies || '',
                    userAgent: data.data?.userAgent || data.userAgent || '',
                    provider: verifiedProvider,
                    endpoints: { [this.classifyEndpoint(url)]: url },
                    headers: data.data?.headers || data.headers || {}
                };

                // 🧬 AFB88 SPEC: Authorization & usetoken
                if (verifiedProvider === 'AFB88') {
                    const headers = data.data?.headers || data.headers || {};
                    
                    // 🛡️ v9.6: Safe URL parsing for relative paths
                    let urlObj: URL | null = null;
                    try {
                        urlObj = new URL(url.startsWith('http') ? url : `https://placeholder.com${url}`);
                    } catch (e) {
                        // URL parsing failed, continue without searchParams
                    }

                    if (headers['Authorization'] || headers['authorization']) {
                        contractData.authorization = headers['Authorization'] || headers['authorization'];
                    } else if (urlObj && urlObj.searchParams.has('k')) {
                        contractData.authorization = urlObj.searchParams.get('k');
                        console.log(`[v3.2] 🧬 Extracted AFB88 Auth from URL (k): ${contractData.authorization.substring(0, 15)}...`);
                    }

                    if (headers['usetoken'] !== undefined) {
                        contractData.usetoken = headers['usetoken'];
                    } else if (urlObj && urlObj.searchParams.has('us')) {
                        contractData.usetoken = urlObj.searchParams.get('us');
                        console.log(`[v3.2] 🧬 Extracted AFB88 usetoken from URL (us): ${contractData.usetoken}`);
                    }
                }

                // 🧬 SABA/ISPORT SPEC: Session & sinfo
                if (verifiedProvider === 'ISPORT') {
                    // 🛡️ v9.6: Safe URL parsing for relative paths
                    let urlObj: URL | null = null;
                    try {
                        urlObj = new URL(url.startsWith('http') ? url : `https://placeholder.com${url}`);
                    } catch (e) {
                        // URL parsing failed, continue without searchParams
                    }
                    
                    const sessionMatch = url.match(/\(S\(([^)]+)\)\)/);
                    if (sessionMatch) {
                        contractData.sessionId = sessionMatch[1];
                    } else if (urlObj && urlObj.searchParams.has('token')) {
                        contractData.sessionId = urlObj.searchParams.get('token');
                        console.log(`[v3.2] 🧬 Extracted Saba Session from URL (token): ${contractData.sessionId.substring(0, 15)}...`);
                    } else if (urlObj && urlObj.searchParams.has('sinfo')) {
                        contractData.sinfo = urlObj.searchParams.get('sinfo');
                    }

                    // Extract sinfo from body
                    const body = (data.data?.requestBody || data.requestBody || '');
                    const sinfoMatch = body.match(/sinfo=([^&]+)/);
                    if (sinfoMatch) {
                        contractData.sinfo = decodeURIComponent(sinfoMatch[1]);
                    }
                }

                // 🛰️ v3.2 VALIDATION
                const isHealthy = (verifiedProvider === 'AFB88' && contractData.authorization && contractData.usetoken) ||
                    (verifiedProvider === 'ISPORT' && contractData.sessionId);

                const auditMsg = `[CONTRACT-AUDIT] ${account}:${verifiedProvider} Status=${isHealthy ? 'HEALTHY' : 'DEGRADED'} | Auth=${!!contractData.authorization} Token=${!!contractData.usetoken} Session=${!!contractData.sessionId}`;
                console.log(auditMsg);
                try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${auditMsg}\n`); } catch (e) { }

                // 🛰️ v3.2 AUDIT
                try {
                    fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] [v3.2-AUDIT] Calling updateContract account=${account} provider=${verifiedProvider} url=${url}\n`);
                    this.registry.updateContract(account, verifiedProvider, contractData);
                } catch (err) {
                    console.error(`[v3.2-ERROR] updateContract failed: ${err.message}`);
                }
            }

            // ===============================
            // 🐣 BIRTH CLASSIFIER (v3.1)
            // ===============================
            const isAfbPgBetOdds =
                verifiedProvider === 'AFB88' &&
                (url.includes('pgbetodds') || url.includes('fnoddsgen') || url.includes('pgmain'));

            // 🔥 v6.1: Added PRIORITY_MATCH_CAPTURE for Account B Status Override
            // 🔥 v7.8: Added DEEP_PARSED and UNPARSED_FEED for unknown structures
            // 🔥 v7.9: Added UNVERIFIED_STRUCTURE for aggressive array parsing
            // 🔥 v8.8: Added XHR and FETCH and ensured UPPERCASE consistency
            const SUBSTANTIVE_TYPES = [
                'ODDS', 'ODDS_BATCH', 'MATCH_BATCH', 'BALANCE', 'API_CONTRACT_RECORDER', 'API_CONTRACT_CAPTURE',
                'STREAM_DATA', 'PRIORITY_MATCH_CAPTURE', 'SABA_JSON_CAPTURE',
                'SABA_JSON_DEEP_PARSED', 'UNPARSED_SABA_FEED', 'UNVERIFIED_STRUCTURE',
                'AFB88_JSON_DEEP_PARSED', 'AFB88_UNVERIFIED_STRUCTURE', 'AFB88_UNPARSED_FEED',
                'SABA_JSON_DEEP_PARSED', 'SABA_UNVERIFIED_STRUCTURE', 'SABA_UNPARSED_FEED',
                'XHR', 'FETCH', 'SESSION_CAPTURE'
            ];
            // 🛡️ v3.5.1 EMERGENCY: ISPORT session_capture often contains match data from iframe
            const isIsportSession = verifiedProvider === 'ISPORT' && type.toUpperCase() === 'SESSION_CAPTURE';
            const isSubstantive = isAfbPgBetOdds || SUBSTANTIVE_TYPES.includes(type.toUpperCase()) || isIsportSession;

            const providerBorn = this.bornProviders.has(regKey);
            const birthGateMsg = `[BIRTH-GATE] account=${account} provider=${verifiedProvider} born=${providerBorn} substantive=${isSubstantive} type=${type} url=${url.substring(0, 40)}`;

            const ts2 = new Date().toISOString();
            if (isSubstantive || type === 'api_contract_capture') {
                try { fs.appendFileSync(this.wireLog, `[${ts2}] ${birthGateMsg}\n`); } catch (e) { }
            }

            // ===============================
            // 🐣 PROVIDER BIRTH (MUST RUN FIRST)
            // ===============================
            if (!providerBorn) {
                if (!isSubstantive) {
                    return;
                }
                // Transition to birth logic happens after parsing for api_contract_recorder
                // But for other substantive types, we birth immediately
                if (!['api_contract_recorder', 'UNPARSED_SABA_FEED', 'UNVERIFIED_STRUCTURE'].includes(type)) {
                    this.markProviderBorn(account, verifiedProvider);
                }
            }

            // ===============================
            // 🔒 IDENTITY LOCK
            // ===============================
            const entry = this.providerRegistry.get(regKey);
            if (!entry) return;

            entry.lastSeen = handleTimestamp;

            // ===============================
            // 🌊 STATELESS STREAM PROCESSING (v3.1 simplified)
            // ===============================
            let parsedResult: { odds: any[], balance: number | null } = { odds: [], balance: null };

            // 🚀 TAHAP 3.5: Universal Decoding (GZIP/Base64/Socket.io)
            // Missions: Delegate decompression to UniversalDecoderService
            let payload = await this.decoder.decode(data.data || data);

            // 🛡️ v3.1 FIX: Handle api_contract_recorder / audit structure
            if (['api_contract_recorder', 'api_contract_capture', 'contract_audit'].includes(type)) {
                payload = await this.decoder.decode(data); // decode the whole object
            }

            try {
                // Constitutional Extraction (Check top level and nested data)
                if (payload && payload.data && payload.data.responseBody) {
                    payload = payload.data.responseBody;
                } else if (payload && payload.responseBody) {
                    payload = payload.responseBody;
                }

                // Ensure we have a clean object if it was a JSON string
                if (typeof payload === 'string' && (payload.startsWith('{') || payload.startsWith('['))) {
                    try {
                        payload = JSON.parse(payload);
                    } catch (e) { }
                }
            } catch (e) {
                console.error(`[PAYLOAD_EXTRACT] Error during payload extraction: ${e.message}`);
                return;
            }

            if (verifiedProvider === 'AFB88') {
                const pStr = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
                const displaySize = pStr.length;

                if (pStr.includes('abet')) {
                    const tsAbet = new Date().toISOString();
                    try { fs.appendFileSync(this.wireLog, `[${tsAbet}] [ABET-DETECTED] URL=${url} Size=${displaySize}\n`); } catch (e) { }
                }

                if (typeof payload === 'string') {
                    try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] [AFB-STRING] URL=${url} Start=${payload.substring(0, 50)}\n`); } catch (e) { }
                }

                if (displaySize > 5000) {
                    const sample = pStr.substring(0, 1000); // 🛰️ v3.2: Larger sample for index mapping
                    const tsA = new Date().toISOString();
                    try { fs.appendFileSync(this.wireLog, `[${tsA}] [AFB-BULK-SAMPLE] URL=${url} Size=${displaySize} Sample=${sample}\n`); } catch (e) { }
                }
            }

            // ============================================================
            // 🛡️ v8.9 HEURISTIC BRUTE-FORCE RECOVERY (Account B Fail-Open)
            // ============================================================
            if (account === 'B') {
                const foundMatches: any[] = [];
                const bruteForceSearch = (obj: any, depth = 0) => {
                    if (depth > 12 || !obj || typeof obj !== 'object') return;

                    const homeKeys = [
                        'HomeName', 'home', 'Home', 'h', 'H', 'ht', 'HT',
                        'HomeTeam', 'hTeam', 'home_team', 'h_name', 'team_a',
                        'team1', 'Team1', 'TeamHome', 'homeName', 'htnm'
                    ];
                    const awayKeys = [
                        'AwayName', 'away', 'Away', 'a', 'A', 'at', 'AT',
                        'AwayTeam', 'aTeam', 'away_team', 'a_name', 'team_b',
                        'team2', 'Team2', 'TeamAway', 'awayName', 'atnm'
                    ];

                    let home = null, away = null;
                    for (const hk of homeKeys) { if (obj[hk] && typeof obj[hk] === 'string' && obj[hk].length > 1) { home = obj[hk].replace(/<[^>]*>/g, '').trim(); break; } }
                    for (const ak of awayKeys) { if (obj[ak] && typeof obj[ak] === 'string' && obj[ak].length > 1) { away = obj[ak].replace(/<[^>]*>/g, '').trim(); break; } }

                    if (home && away) {
                        let matchId = obj.matchId || obj.mid || obj.MatchId || obj.Matchid || obj.id;
                        if (!matchId || String(matchId).length < 5) {
                            // 🛡️ v8.5 [STRICT]: Deterministic Identity ONLY.
                            // ADR-005: Fallbacks are forbidden. Fail-fast if fingerprinting fails.
                            matchId = EventIdentity.generateFingerprint('soccer', '0000-00-00T00:00:00.000Z', home, away);
                        }

                        foundMatches.push({
                            matchId,
                            home,
                            away,
                            HomeName: home,
                            AwayName: away,
                            league: obj.LeagueName || obj.league || 'BruteForce',
                            ...obj,
                            _heuristic: true
                        });
                    }

                    if (Array.isArray(obj)) {
                        for (const item of obj) bruteForceSearch(item, depth + 1);
                    } else {
                        for (const key of Object.keys(obj)) {
                            if (typeof obj[key] === 'object') bruteForceSearch(obj[key], depth + 1);
                        }
                    }
                };

                bruteForceSearch(payload);
                if (foundMatches.length > 0) {
                    console.log(`[RAW-B-BRUTE] ✅ Heuristic found ${foundMatches.length} matches. Injecting to Discovery...`);
                    for (const m of foundMatches) {
                        this.discoveryService.registerMatch('B', verifiedProvider, m);
                    }
                }
            }

            // 2. Route to Stateless Parser
            if (verifiedProvider === 'AFB88' || type.startsWith('AFB88_')) {
                console.log(`[WORKER] 🔍 Calling AFB88 contract parser for account ${account}, type ${type}, payload size ${JSON.stringify(payload).length}`);
                try {
                    const matches = parseProvider('AFB88', payload as any);
                    parsedResult = { odds: matches || [], balance: null };
                    if (!parsedResult.odds || parsedResult.odds.length === 0) {
                        parsedResult = parseAfbPacket(payload);
                    }
                } catch (err) {
                    console.warn('[WORKER] ⚠️ parseProvider(AFB88) failed, falling back to legacy parser', err?.message || err);
                    parsedResult = parseAfbPacket(payload);
                }
            } else if (['CMD368', 'ISPORT', 'SABA_JSON_DEEP_PARSED', 'UNPARSED_SABA_FEED', 'UNVERIFIED_STRUCTURE'].includes(verifiedProvider) ||
                type.startsWith('SABA_') || ['unparsed_saba_feed', 'unverified_structure'].includes(type.toLowerCase())) {

                // 🛡️ v9.9-DEBUG: Log payload structure for ISPORT Account A
                if (account === 'A' && verifiedProvider === 'ISPORT') {
                    const pStr = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
                    const pKeys = payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 10).join(',') : 'N/A';
                    console.log(`\x1b[33m[v9.9-DEBUG-ISPORT-A] 🔍 Payload Keys: ${pKeys} | Size: ${pStr.length} | URL: ${url.substring(0, 60)}\x1b[0m`);
                    try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] [ISPORT-A-PAYLOAD] Keys=${pKeys} Size=${pStr.length} Sample=${pStr.substring(0, 500)}\n`); } catch (e) { }
                }

                // 🛡️ v8.7: If verifiedProvider is ISPORT but it looks like a positional array, 
                // the AFB parser's positional logic is more robust.
                try {
                    const matches = parseProvider('SABA', payload as any);
                    parsedResult = { odds: matches || [], balance: null };
                    if (!parsedResult.odds || parsedResult.odds.length === 0) {
                        if (Array.isArray(payload) && payload.length > 0 && typeof payload[0] !== 'object') {
                            parsedResult = parseAfbPacket(payload);
                        } else {
                            parsedResult = parseSportsbookPacket(payload);
                        }
                    }
                } catch (err) {
                    console.warn('[WORKER] ⚠️ parseProvider(SABA) failed, falling back to legacy parsers', err?.message || err);
                    if (Array.isArray(payload) && payload.length > 0 && typeof payload[0] !== 'object') {
                        parsedResult = parseAfbPacket(payload);
                    } else {
                        parsedResult = parseSportsbookPacket(payload);
                    }
                }

                if (type === 'unparsed_saba_feed') {
                    const rawKeys = data.errorKeys || Object.keys(payload || {}).join(',');
                    this.logger.warn(`[RAW-SABA-FEED] 📥 Processing unparsed feed from Account ${account} (Keys: ${rawKeys})`);
                }
            }

            if (url.includes('/api/player/balance')) {
                const balDebug = `[BALANCE-PAYLOAD-DEBUG] B:ISPORT Raw: ${JSON.stringify(payload).substring(0, 1000)}`;
                console.log(balDebug);
                try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${balDebug}\n`); } catch (e) { }
            }

            // 3. Process Results
            if (parsedResult.odds.length > 0) {
                // 🐣 LATE BIRTH (For Recorder data)
                this.providerRegistry.get(regKey).state = 'LIVE';
                const streamMsg = `[STREAM] 🌊 Processed ${parsedResult.odds.length} odds for ${regKey}`;
                console.log(streamMsg);
                try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${streamMsg}\n`); } catch (e) { }
                await this.processOddsBatch(account, verifiedProvider, parsedResult.odds, data.clientId);
            }

            if (parsedResult.balance !== null) {
                this.balance[account] = parsedResult.balance.toFixed(2);
                const balMsg = `[BALANCE-SYNC] ${account} updated to ${this.balance[account]}`;
                console.log(balMsg);
                try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${balMsg}\n`); } catch (e) { }
                this.broadcastStatus();
            }

            // 4. Update Guardian Liveness
            const substantiveCount = parsedResult.odds.length;
            this.guardianService.updateStatus(account, verifiedProvider, type, substantiveCount);

            // 🟢 LIVE TRANSITION (Green Lamp Rule < 30s)
            if (substantiveCount > 0) {
                if (entry.state !== 'LIVE') {
                    console.log(`[v3.1] Stream Active -> [LIVE] ${account}/${verifiedProvider} (${substantiveCount})`);
                    entry.state = 'LIVE';
                    this.pipelineStage[account] = 'LIVE_FLOW';
                    this.broadcastStatus();
                }
            }
        } catch (err) {
            console.error(`[WORKER-FATAL] handleEndpointCaptured failed: ${err.message}`);
            try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] [CRITICAL-ERROR] ${err.stack}\n`); } catch (e) { }
        }
    }

    private markProviderBorn(account: string, provider: string) {
        const regKey = `${account}:${provider}`;
        if (this.bornProviders.has(regKey)) return;

        // 🛡️ v9.1: Thread-safe Birth Registration
        this.bornProviders.add(regKey);

        console.log(`[v3.1] Backend Classified -> [BIRTH] ${account}/${provider}`);
        console.log(`[STATUS_SYNC] Provider: ${provider} | Stream: BIRTH | Status: INITIALIZING`);

        this.registerProvider(account, provider);
        this.assignToSlot(account, provider);
    }


    private registerProvider(account: string, provider: string) {
        if (!account || !provider || account === 'DESKTOP') return;

        const regKey = `${account}:${provider}`;

        // TRACE LOG to wire_debug
        const ts = new Date().toISOString();
        try { fs.appendFileSync(this.wireLog, `[${ts}] [REGISTER-PROVIDER] key=${regKey} exists=${this.providerRegistry.has(regKey)}\n`); } catch (e) { }

        if (!this.providerRegistry.has(regKey)) {
            console.log(`[WORKER] 📒 Registry Updated: ${account}/${provider} (Waiting for substantive data to assign slot)`);
            try { fs.appendFileSync(this.wireLog, `[${ts}] [REGISTER-PROVIDER] CREATED ${regKey}\n`); } catch (e) { }

            this.providerRegistry.set(regKey, {
                name: provider,
                account: account,
                state: 'HEARTBEAT_ONLY', // v3.1: Start in heartbeat state upon substantive birth
                lastSeen: Date.now()
            });
        }
    }

    private assignToSlot(account: string, provider: string) {
        // 🛡️ GUARD: Only allow providers registered in PROVIDERS architecture
        // Ref: provider_arsitek.md - Only recognized providers should occupy UI slots
        if (!account || !provider || account === 'DESKTOP') return;
        if (!PROVIDERS[provider]) return; // Provider must exist in registry

        // TRACE LOG
        const ts = new Date().toISOString();

        const slots = this.providerSlots[account];
        const alreadyInSlot = slots?.includes(provider);
        const slotCount = slots?.length || 0;

        // Log current state
        try { fs.appendFileSync(this.wireLog, `[${ts}] [ASSIGN-SLOT] account=${account} provider=${provider} currentSlots=[${slots?.join(',') || 'NONE'}] alreadyIn=${alreadyInSlot} count=${slotCount}\n`); } catch (e) { }

        if (slots && !alreadyInSlot) {
            if (slotCount < 5) {
                slots.push(provider);
                console.log(`[WORKER] 🎰 Visual Slot Assigned: ${provider} to ${account} Slot ${slots.length}`);
                try { fs.appendFileSync(this.wireLog, `[${ts}] [ASSIGN-SLOT] SUCCESS ${provider} to ${account} Slot ${slots.length}\n`); } catch (e) { }

                // Promote state to HEARTBEAT_ONLY if it was INACTIVE
                const regKey = `${account}:${provider}`;
                const entry = this.providerRegistry.get(regKey);
                if (entry && entry.state === 'INACTIVE') {
                    entry.state = 'HEARTBEAT_ONLY';
                    try { fs.appendFileSync(this.wireLog, `[${ts}] [ASSIGN-SLOT] STATE -> HEARTBEAT_ONLY for ${regKey}\n`); } catch (e) { }
                }
            } else {
                try { fs.appendFileSync(this.wireLog, `[${ts}] [ASSIGN-SLOT] FAILED ${provider} - slots full (5)\n`); } catch (e) { }
            }
        } else if (alreadyInSlot) {
            // Already in slot - this is expected, no action needed
        } else {
            try { fs.appendFileSync(this.wireLog, `[${ts}] [ASSIGN-SLOT] FAILED ${provider} - no slots array for ${account}\n`); } catch (e) { }
        }

        // ALWAYS BROADCAST TO SYNC FRONTEND
        this.broadcastStatus();
    }

    private classifyByPayload(data: any): string | null {
        if (!data) return null;

        // 🛡️ v3.1 FIX: Handle both wrapped and unwrapped payloads
        let body = data;
        if (data.data) body = data.data;
        if (data.responseBody) body = data.responseBody;

        // If body is still string, try parse
        if (typeof body === 'string') {
            if (body.startsWith('{') || body.startsWith('[')) {
                try { body = JSON.parse(body); } catch (e) { }
            }
        }

        if (!body || typeof body !== 'object') return null;

        // 🛡️ UNWRAP Array/Socket.io frames
        if (Array.isArray(body)) {
            // Check elements for AFB88 fingerprints
            const afbKeys = ['st', 'ba', 'fi', 'ms'];
            if (body.some(item => typeof item === 'string' && afbKeys.includes(item))) return 'AFB88';

            // Deep check for objects inside
            for (const item of body) {
                if (typeof item === 'object' && item !== null) {
                    const res = this.classifyByPayload(item);
                    if (res) return res;
                }
            }
        }

        // 🛡️ AFB88 Fingerprint (Expanded)
        if (body.db !== undefined || body.ServerTime !== undefined || body.Balance2D !== undefined) return 'AFB88';
        if (body.ba !== undefined || body.st !== undefined || body.fi !== undefined || body.ms !== undefined) {
            return 'AFB88';
        }
        if (body.odds_batch || body.pgBetOdds || body.pgMain) return 'AFB88';

        // 🛡️ CMD368 Fingerprint
        if (body.Matches !== undefined || body.Leagues !== undefined) {
            return 'CMD368';
        }

        // 🛡️ ISPORT Fingerprint
        if (body.Data && Array.isArray(body.Data) && body.Data.length > 0) {
            const item = body.Data[0];
            if (item.MarketId !== undefined || item.SportType !== undefined) {
                return 'ISPORT';
            }
        }

        return null;
    }

    private async processOddsBatch(account: string, provider: string, data: any, clientId?: string) {
        // Simple array check
        let items = [];
        if (Array.isArray(data)) items = data;
        else if (data && data.events) items = data.events;
        else if (data && data.d && data.d.MatchList) items = data.d.MatchList; // 🛡️ v8.5 SABA Support
        else if (data && data.pgBetOdds) items = data.pgBetOdds; // 🛡️ v8.5 AFB Support
        else return;

        // 🛡️ v3.1 LOCKED - Data Classification
        const dataType = this.registry.classifyData(data);

        // Filter out TICKET_INFO (betslip garbage)
        if (dataType === 'TICKET_INFO') {
            const ts = new Date().toISOString();
            try { fs.appendFileSync(this.wireLog, `[${ts}] [DATA-REJECT] account=${account} provider=${provider} reason=TICKET_INFO\n`); } catch (e) { }
            return; // Don't process bet slip data
        }

        // Record MATCH_LIST receipt for freshness tracking
        if (dataType === 'MATCH_LIST') {
            this.registry.recordMatchList(account, provider);
        }

        // 🛡️ PROGRESSIVE GUARDIAN UPDATE (v3.1)
        this.guardianService.updateStatus(account, provider, 'odds_batch', items.length);

        // 🚀 TAHAP 3: Local Order Book SNAPSHOT logic
        if (dataType === 'MATCH_LIST' && items.length > 10) {
            console.log(`[LOB-ENGINE] 📸 SNAPSHOT Detected for ${account}:${provider} (Items: ${items.length}). Purging existing local state...`);
            this.discoveryService.cleanAccount(account);
        }

        if (dataType === 'DELETE') {
            const matchId = data.matchId || data.mid || data.Matchid;
            if (matchId) {
                this.discoveryService.deleteMatch(account as 'A' | 'B', matchId);
                return;
            }
        }

        const ts = new Date().toISOString();
        try { fs.appendFileSync(this.wireLog, `[${ts}] [PROCESS-ODDS] account=${account} provider=${provider} count=${items.length} type=${dataType}\n`); } catch (e) { }

        // 🚀 NON-BLOCKING BATCH PROCESSING
        // Ref: ARSITEKTUR_FINAL.md - Parallel Execution Protocol
        const matchPromises = items.map(async (match) => {
            // 🛡️ v7.5 Deterministic Client Isolation
            if (typeof match === 'object' && match !== null && clientId) {
                match.clientId = clientId;
            }

            try {
                // 🔍 DEBUG: Log before registerMatch
                console.log(`[PRE-REGISTER] account=${account} matchKeys=${Object.keys(match || {}).join(',')}`);
                
                // 1. Let Discovery handle the Event Registration (ASYNC/PARALLEL)
                await this.discoveryService.registerMatch(account as 'A' | 'B', provider, match);

                // 🔍 DEBUG: Log before normalizeMarket
                console.log(`[PRE-NORMALIZE] account=${account} calling marketService.normalizeMarket`);
                
                // 2. Market Normalization Logic (STAGE 2)
                const normalizedItems = this.marketService.normalizeMarket(account, match);

                if (normalizedItems.length === 0) return;

                const hDisplay = (match.HomeName || match.home || match.ht || match.htnm || match.h || '').trim();
                const aDisplay = (match.AwayName || match.away || match.at || match.atnm || match.a || '').trim();

                if (!hDisplay || !aDisplay || hDisplay.length < 2 || aDisplay.length < 2) return;

                // Process normalization results
                for (const normItem of normalizedItems) {
                    // 3. Pairing / Arbitrage Engine (STAGE 3)
                    const rawOdds: RawOdds = {
                        eventId: normItem.eventId,
                        provider: account as 'A' | 'B',
                        bookmaker: provider,
                        league: match.league || match.LeagueName || 'Unknown',
                        matchId: match.matchId || match.Matchid,
                        market: normItem.type,
                        home: String(hDisplay),
                        away: String(aDisplay),
                        odds: {
                            selection: normItem.selection,
                            line: String(normItem.line),
                            val: normItem.odds
                        },
                        receivedAt: Date.now()
                    };

                    // Propagate selectionId if present in normalized market or match selections
                    const selIdFromNorm = (normItem as any).selectionId;
                    if (selIdFromNorm) rawOdds.selectionId = selIdFromNorm;
                    else if (Array.isArray(match.selections) && match.selections.length > 0) {
                        // try find matching selection by odds or name
                        const found = match.selections.find((s: any) => {
                            if (s == null) return false;
                            const sOdd = (s.Price ?? s.price ?? s.odds ?? s.p);
                            if (sOdd != null && Number(sOdd) === Number(normItem.odds)) return true;
                            const sName = (s.Name || s.name || s.SelectionName || '').toString();
                            if (sName && sName.toLowerCase().includes(String(normItem.selection).toLowerCase())) return true;
                            return false;
                        });
                        if (found) rawOdds.selectionId = found.SelectionId ?? found.SelectionId ?? found.Oddsid ?? found.OddsId ?? found.Id ?? found.id;
                    }

                    this.pairingService.processIncomingOdds(rawOdds);
                }
            } catch (e) {
                // Log error without blocking the rest of the batch
                console.error(`[WORKER-ITEM-ERR] Single item processing failed: ${e.message}`);
            }
        });

        // 🔥 EXECUTE ENTIRE BATCH IN PARALLEL (NON-BLOCKING PAIRING PHASE)
        await Promise.all(matchPromises);

        if (account === 'B') {
            console.log(`\x1b[32m[DEBUG-ISPORT] ✅ ISPORT DATA PARSED: ${items.length} items from ${provider}\x1b[0m`);
        }


        // [AFB-WORKER] MANDATORY LOG
        if (provider === 'AFB88' && items.length > 0) {
            console.log(`[AFB-WORKER] 📤 ODDS_ENTITY_OUT count=${items.length}`);
        }
    }

    /**
     * 🛰️ v10.0 CONTRACT CLASSIFIER (Config-Driven)
     * Identify provider based on URL signature and payload fingerprint
     * TIDAK hardcode account mapping - hanya return provider name
     */
    private classifyContract(url: string, data: any, type?: string): string | null {
        const lowerUrl = url.toLowerCase();
        const lowerType = (type || '').toLowerCase();

        // 🛡️ v3.1 FIX: Explicit Type Override (from Injected Script method)
        if (lowerType.includes('afb88')) return 'AFB88';
        if (lowerType.includes('isport') || lowerType.includes('saba')) return 'ISPORT';
        if (lowerType.includes('cmd368')) return 'CMD368';

        // 🎯 v10.0: Use centralized detection
        const detected = detectProviderFromUrl(url);
        if (detected !== 'UNASSIGNED') {
            return detected === 'SABA' ? 'ISPORT' : detected;
        }

        // 1. SABA / ISPORT (PATH_SESSION)
        // Signatures: ISPORT_DOMAINS, (S( Session
        if (ISPORT_DOMAINS.some(d => lowerUrl.includes(d)) || lowerUrl.includes('/betting/') || lowerUrl.includes('(s(')) {
            return 'ISPORT';
        }

        // 2. CMD368 (AUTO_PUSH)
        // Signatures: sportitems, getmatch, getsportitems
        if (lowerUrl.includes('sportitems') || lowerUrl.includes('getmatch') ||
            lowerUrl.includes('getsportitems') || lowerUrl.includes('matchlist')) {
            // Check URL for ISPORT patterns
            if (lowerUrl.includes('aro') || lowerUrl.includes('qq188')) return 'ISPORT';
            return 'CMD368';
        }

        // 🧬 FALLBACK: Classify by Payload (for internal packets or relative URLs)
        return this.classifyByPayload(data);
    }

    broadcastStatus() {
        // 🔥 SYNC: Ensure providerStatus matches providerRegistry
        // Reset all slots first
        for (const key of Object.keys(this.providerStatus)) {
            const account = key[0]; // 'A' or 'B'
            const slotNum = parseInt(key[1]); // 1-5

            // Check if this slot has a registered provider
            const providerName = this.providerSlots[account]?.[slotNum - 1];
            if (providerName) {
                const regKey = `${account}:${providerName}`;
                const entry = this.providerRegistry.get(regKey);

                // Get Guardian Status
                const guardianState = this.guardianService.getStatus(account, providerName);

                if (entry) {
                    let finalState: ProviderState = entry.state;

                    // GUARDIAN OVERRIDE: Map guardian states to worker states
                    if (guardianState) {
                        if (guardianState.state === 'DEAD') finalState = 'DEAD';
                        else if (guardianState.state === 'HEARTBEAT_ONLY') finalState = 'HEARTBEAT_ONLY';
                        else if (guardianState.state === 'LIVE') finalState = 'LIVE';
                    }

                    // 2. DATA PLANE REALITY (Discovery)
                    if (finalState === 'LIVE') {
                        const lastDataTime = guardianState?.lastDataTime || 0;
                        const ageSeconds = (Date.now() - lastDataTime) / 1000;
                        const threshold = providerName === 'AFB88' ? 10 : 30;
                        if (ageSeconds > threshold) {
                            finalState = 'HEARTBEAT_ONLY';
                        }
                    }

                    this.providerStatus[key] = finalState;
                } else {
                    this.providerStatus[key] = 'INACTIVE';
                }
            } else {
                this.providerStatus[key] = 'INACTIVE';
            }
        }

        // Build provider names map for UI display
        const providerNames: Record<string, string> = {};
        for (const [key, providers] of Object.entries(this.providerSlots)) {
            if (providers.length > 0) {
                providerNames[key] = providers[0];
            }
            providers.forEach((name, idx) => {
                if (name) {
                    providerNames[`${key}${idx + 1}`] = name;
                }
            });
        }

        const providersWithClass = {};
        for (const [key, state] of Object.entries(this.providerStatus)) {
            const providerName = providerNames[key] || 'GENERIC';
            providersWithClass[key] = {
                state,
                class: PROVIDERS[providerName]?.class || 'AUTO_PUSH'
            };
        }

        const discoveryStats = this.discoveryService.getStats();

        // 🛡️ v11.0: If account is OFF, report 0 for balance and events
        const effectiveBalanceA = this.config.accountA_active ? this.balance.A : '0.00';
        const effectiveBalanceB = this.config.accountB_active ? this.balance.B : '0.00';
        const effectiveEventsA = this.config.accountA_active ? discoveryStats.registryASize : 0;
        const effectiveEventsB = this.config.accountB_active ? discoveryStats.registryBSize : 0;

        this.gateway.sendUpdate('system_status', {
            providers: providersWithClass,
            providerNames: providerNames,
            slots: this.providerSlots,
            balanceA: effectiveBalanceA,
            balanceB: effectiveBalanceB,
            accountA_active: this.config.accountA_active,
            accountB_active: this.config.accountB_active,
            workers: this.isRunning ? 'RUNNING' : 'STOPPED',
            guard: 'SHADOW_MODE_BLOCKED',
            pipelineA: this.pipelineStage.A,
            pipelineB: this.pipelineStage.B,
            activeEventsA: effectiveEventsA,
            activeEventsB: effectiveEventsB,
            activePairs: (this.config.accountA_active && this.config.accountB_active) ? discoveryStats.confirmedPairs : 0
        });

        const statusMsg = `[STATUS-SYNC] ID=${this.instanceId} Broadcasting A_active=${this.config.accountA_active} B_active=${this.config.accountB_active}`;
        try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${statusMsg}\n`); } catch (e) { }
    }
    
    /**
     * 🎯 v10.0 CONFIG-DRIVEN ROUTING
     * Get SystemConfig with caching for efficient routing lookups
     */
    private async getSystemConfig(): Promise<SystemConfig> {
        const now = Date.now();
        
        // Return cached if still valid
        if (this.systemConfigCache && (now - this.systemConfigCacheTime) < this.SYSTEM_CONFIG_TTL) {
            return this.systemConfigCache;
        }
        
        // Build from Redis config
        try {
            const redisConfig = await this.redisService.getConfig();
            
            this.systemConfigCache = {
                accountA: {
                    account: 'A',
                    provider: (redisConfig.providerA || 'SABA') as ProviderType,
                    url: redisConfig.urlA || '',
                    active: redisConfig.accountA_active || false,
                    updatedAt: Date.now(),
                },
                accountB: {
                    account: 'B',
                    provider: (redisConfig.providerB || 'AFB88') as ProviderType,
                    url: redisConfig.urlB || '',
                    active: redisConfig.accountB_active || false,
                    updatedAt: Date.now(),
                },
                minProfit: redisConfig.min || 1.5,
                maxProfit: redisConfig.max || 15.0,
            };
            
            this.systemConfigCacheTime = now;
            return this.systemConfigCache;
            
        } catch (e) {
            console.error(`[CONFIG-CACHE] Failed to get config: ${(e as Error).message}`);
            
            // Return default with SABA=A, AFB88=B as fallback
            return {
                accountA: { account: 'A', provider: 'SABA', url: '', active: true, updatedAt: 0 },
                accountB: { account: 'B', provider: 'AFB88', url: '', active: true, updatedAt: 0 },
                minProfit: 1.5,
                maxProfit: 15.0,
            };
        }
    }
    
    resetAccount(account: string) {
        console.log(`[WORKER] 🧹 RESETTING ACCOUNT ${account} (Purging Ghosts)`);
        console.log(`[RESET] Removing workers: ${account}:*`);
        console.log(`[RESET] Removing sessions: ${account}`);
        console.log(`[RESET] Removing providers: ${account}`);
        console.log(`[RESET] Removing balances: ${account}`);

        // 1. Reset UI Slots
        for (let i = 1; i <= 5; i++) {
            this.providerStatus[`${account}${i}`] = 'INACTIVE';
        }

        // 2. FULLY DELETE from Provider Registry (not just set inactive)
        const prefix = `${account}:`;
        for (const key of this.providerRegistry.keys()) {
            if (key.startsWith(prefix)) {
                this.providerRegistry.delete(key);
            }
        }
        // 🔒 PURGE BIRTH STATE
        for (const key of this.bornProviders) {
            if (key.startsWith(prefix)) {
                this.bornProviders.delete(key);
            }
        }
        this.discoveryService.setProviderState(account as 'A' | 'B', false);
        this.providerSlots[account] = [];
        this.balance[account] = '0.00';

        // 3. STATLESS RESET: No workers to kill

        // 4. CLEAN GUARDIAN REGISTRY
        this.guardianService.cleanAccountRegistry(account);

        // 5. CLEAN CONTRACT REGISTRY
        this.registry.cleanAccount(account);

        // 6. CLEAN DISCOVERY SERVICE (registries, bindings, metrics)
        this.discoveryService.cleanAccount(account as 'A' | 'B');

        // 7. [v7.5] CLEAN PAIRING SERVICE
        this.pairingService.cleanAccount(account as 'A' | 'B');

        // 8. PURGE TAB BINDINGS
        for (const [tabId, acc] of this.tabToAccountMap.entries()) {
            if (acc === account) {
                this.tabToAccountMap.delete(tabId);
            }
        }

        console.log(`[v3.1] [PURGE-LOG] account=${account} registry=0 slots=0 workers=0 guardian=0 tabs=0`);
        console.log(`[RESET] ✅ Account ${account} fully purged.`);

        this.broadcastStatus();
    }

    private isNoise(url: string): boolean {
        const u = url.toLowerCase();
        const SKIP_PATTERNS = [
            'localhost', '127.0.0.1', 'socket.io', 'google', 'facebook', 'analytics', 'doubleclick', 'gtag',
            'livechatinc', 'secure.livechatinc', 'static', 'font', '.png', '.jpg', '.js', '.css', 'favicon'
        ];
        // Special Case: linkcdn.cloud is AFB88 WS
        if (u.includes('linkcdn.cloud')) return false;

        return SKIP_PATTERNS.some(p => u.includes(p));
    }

    private isRelevant(url: string): boolean {
        const u = url.toLowerCase();
        const RELEVANT_PATTERNS = [
            'getmatch', 'getodds', 'hbetodds', 'getleague', 'getmarket', 'sportitems', 'data.asmx', 'favorites',
            '/api/', '/sports/', '/betting/', 'hdpou', 'desktopmenu', '/bet/',
            'ezc', 'afb', 'linkcdn', 'wsfev2', 'isport', 'qq188', 'mpo', 'jps9',
            ...ISPORT_DOMAINS
        ];
        return RELEVANT_PATTERNS.some(p => u.includes(p));
    }

    private classifyEndpoint(url: string): string {
        const u = url.toLowerCase();
        if (u.includes('desktopmenu') || u.includes('api/menu')) return 'menu';
        if (u.includes('getmyleague') || u.includes('api/getmatch')) return 'match_list';
        if (u.includes('gettickets') || u.includes('api/odds')) return 'odds';
        if (u.includes('/sports/')) return 'sports_ui';
        return 'other';
    }

    private detectMarketType(market: string, selection: string): "FT_HDP" | "FT_OU" | "HT_HDP" | "HT_OU" {
        const m = (market || '').toUpperCase();
        const s = (selection || '').toUpperCase();
        const isHT = m.includes('HT') || m.includes('HALF') || m.includes('1H');
        const isOU = s.includes('OVER') || s.includes('UNDER') || m.includes('OU') || m.includes('OVER');
        if (isHT) return isOU ? 'HT_OU' : 'HT_HDP';
        return isOU ? 'FT_OU' : 'FT_HDP';
    }

    public getProviderStatus(account: string, provider: string): ProviderState {
        const regKey = `${account}:${provider}`;
        const entry = this.providerRegistry.get(regKey);
        if (!entry) return 'INACTIVE';

        // Find the slot to get the current UI-aligned state
        const slots = this.providerSlots[account] || [];
        const slotIdx = slots.indexOf(provider);
        if (slotIdx === -1) return entry.state;

        const statusKey = `${account}${slotIdx + 1}`;
        return this.providerStatus[statusKey] || entry.state;
    }

    public getContract(account: string, provider: string): SportsbookContract | null {
        return this.registry.getContract(`${account}:${provider}`);
    }

    public emergencyStop() {
        console.log('🚨 [PANIC-STOP] EMERGENCY SHUTDOWN TRIGGERED');
        this.isRunning = false;

        // All stream processing stops as isRunning = false

        // 2. Clear All Registries
        this.providerRegistry.clear();
        this.bornProviders.clear();
        this.providerSlots.A = [];
        this.providerSlots.B = [];

        // 3. Mark all UI slots as INACTIVE (Grey)
        for (const key of Object.keys(this.providerStatus)) {
            this.providerStatus[key] = 'INACTIVE';
        }

        // 4. Force UI update
        this.broadcastStatus();

        const ts = new Date().toISOString();
        try { fs.appendFileSync(this.wireLog, `[${ts}] 🚨 [PANIC-STOP] System halted manually via UI.\n`); } catch (e) { }
    }

    private async triggerParallelLaunch(account: string) {
        console.log(`[ORCHESTRATOR] ⚡ Parallel Launch Triggered for Account ${account}`);
    }

    private async runProviderJob(provider: string) {
        console.log(`[ORCHESTRATOR] 🛰️  Starting Parallel Job for ${provider}`);
        return true;
    }
}

