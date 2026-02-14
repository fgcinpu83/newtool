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
import { ProviderSessionManager } from '../managers/provider-session.manager';
import { CommandRouterService } from '../command/command-router.service';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';
import { InternalEventBusService } from '../events/internal-event-bus.service';
import { InternalFsmService, ToggleState } from '../events/internal-fsm.service';
import { AccountRuntimeManager } from '../runtime/account-runtime.manager'
import { AccountContextManager } from '../runtime/account-context.manager'
import { SqliteService } from '../shared/sqlite.service'

// ðŸ”¥ PROVIDER STATE MACHINE
// Expanded to include Guardian states
export type ProviderState = 'INACTIVE' | 'SESSION_BOUND' | 'LIVE' | 'IDLE' | 'RECOVERING' | 'DEAD' | 'HEARTBEAT_ONLY' | 'NO_DATA';

// 🛡️ FINAL FIX: TOGGLE FSM (Atomic State Machine)
// ToggleState is provided by InternalFsmService (single source of truth)

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

    // Non-destructive runtime isolation manager (Phase 1)
    private runtimeManager: import('../runtime/account-runtime.manager').AccountRuntimeManager
    // Per-account context manager (A/B isolation)
    private accountContexts = new (require('../runtime/account-context.manager').AccountContextManager)()

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

    // 🛡️ CRITICAL FIX: TOGGLE ON CRASH PREVENTION - READY STATE FLAGS
    private chromeReady: boolean = false;
    private injectedReady: boolean = false;
    private cdpReady: boolean = false;

    // 🛡️ FINAL FIX: TOGGLE FSM - handled by InternalFsmService

    // 🛡️ COMMAND VALIDATOR - Prevent duplicate commands
    private lastCommandTime: Record<string, number> = {};
    private readonly COMMAND_COOLDOWN = 1000; // 1 second cooldown between identical commands

    // ─── READINESS FLAG SETTERS ─────────────────────

    /** Set Chrome ready flag when Chrome connection is established */
    setChromeReady(ready: boolean) {
        if (this.chromeReady !== ready) {
            this.chromeReady = ready;
            console.log(`[WORKER] 🔧 Chrome ready: ${ready}`);
            this.broadcastReadinessStatus();
        }
    }

    /** Set injected ready flag when first injected event is received */
    setInjectedReady(ready: boolean) {
        if (this.injectedReady !== ready) {
            this.injectedReady = ready;
            console.log(`[WORKER] 🔧 Injected ready: ${ready}`);
            this.broadcastReadinessStatus();
        }
    }

    /** Set CDP ready flag when first CDP event is received */
    setCdpReady(ready: boolean) {
        if (this.cdpReady !== ready) {
            this.cdpReady = ready;
            console.log(`[WORKER] 🔧 CDP ready: ${ready}`);
            this.broadcastReadinessStatus();
        }
    }

    /** Broadcast current readiness status */
    private broadcastReadinessStatus() {
        this.gateway.sendUpdate('pipeline:readiness', {
            chromeReady: this.chromeReady,
            injectedReady: this.injectedReady,
            cdpReady: this.cdpReady,
            allReady: this.chromeReady && this.injectedReady && this.cdpReady,
            timestamp: Date.now()
        });
    }

    /**
     * Wait for a browser open event for the given account.
     * - listens to internalBus for `BROWSER_OPENED` / `BROWSER_OPEN_FAILED`
     * - supports retries and per-attempt timeout
     */
    private async waitForBrowserOpen(account: string, opts?: { timeoutMs?: number; retries?: number; retryDelayMs?: number }): Promise<boolean> {
        const timeoutMs = opts?.timeoutMs ?? 2000;
        const retries = opts?.retries ?? 2;
        const retryDelayMs = opts?.retryDelayMs ?? 500;

        // Fast-path: if Chrome already has the expected whitelabel tab open, treat as opened
        try {
            const expectedUrl = account === 'A' ? this.config.urlA : this.config.urlB;
            if (expectedUrl && this.chromeManager && (this.chromeManager as any).getTabs) {
                try {
                    const port = (require('../managers/chrome-connection.manager').ChromeConnectionManager).portFor(account as any);
                    const tabs = await this.chromeManager.getTabs(port);
                    const found = tabs && tabs.some((t: any) => t && t.url && String(t.url).includes(expectedUrl));
                    if (found) return true;
                } catch (e) { /* ignore chrome probing errors */ }
            }
        } catch (e) { /* swallow */ }

        for (let attempt = 0; attempt <= retries; attempt++) {
            const result = await new Promise<'opened' | 'failed' | 'timeout'>(resolve => {
                let resolved = false;
                const onOpened = (payload: any) => {
                    try {
                        if (!payload || payload.account !== account) return;
                            try { fs.appendFileSync(this.wireLog, JSON.stringify({ ts: Date.now(), event: 'WAIT_FOR_BROWSER_OPEN_EVENT_RECEIVED', account, payload: (typeof payload === 'object' ? JSON.stringify(payload).substring(0,500) : String(payload)) }) + '\n'); } catch (e) {}
                            if (!resolved) { resolved = true; cleanup(); resolve('opened'); }
                        } catch (e) { /* swallow */ }
                    };
                    const onFailed = (payload: any) => {
                        try {
                            if (!payload || payload.account !== account) return;
                            try { fs.appendFileSync(this.wireLog, JSON.stringify({ ts: Date.now(), event: 'WAIT_FOR_BROWSER_OPEN_FAILED_RECEIVED', account, payload: (typeof payload === 'object' ? JSON.stringify(payload).substring(0,500) : String(payload)) }) + '\n'); } catch (e) {}
                            if (!resolved) { resolved = true; cleanup(); resolve('failed'); }
                        } catch (e) { /* swallow */ }
                    };
                    const cleanup = () => {
                        try { this.internalBus && (this.internalBus as any).off && (this.internalBus as any).off('BROWSER_OPENED', onOpened); } catch (e) {}
                        try { this.internalBus && (this.internalBus as any).off && (this.internalBus as any).off('BROWSER_OPEN_FAILED', onFailed); } catch (e) {}
                    };

                    // Attach listeners (InternalEventBusService has `on`/`off` in real runtime)
                    try { fs.appendFileSync(this.wireLog, JSON.stringify({ ts: Date.now(), event: 'WAIT_FOR_BROWSER_OPEN_LISTENER_ATTACHED', account }) + '\n'); } catch (e) {}
                    try { (this.internalBus as any).on('BROWSER_OPENED', onOpened); } catch (e) { /* swallow */ }
                    try { (this.internalBus as any).on('BROWSER_OPEN_FAILED', onFailed); } catch (e) { /* swallow */ }

                    // timeout for this attempt
                    setTimeout(() => {
                        if (!resolved) { resolved = true; cleanup(); resolve('timeout'); }
                    }, timeoutMs);
                });

            if (result === 'opened') return true;
            if (result === 'failed') return false;

            // After a timeout, attempt a secondary probe of Chrome tabs (fallback for missed internal event)
            try {
                const expectedUrl = account === 'A' ? this.config.urlA : this.config.urlB;
                if (expectedUrl && this.chromeManager && (this.chromeManager as any).getTabs) {
                    try {
                        const port = (require('../managers/chrome-connection.manager').ChromeConnectionManager).portFor(account as any);
                        const tabs = await this.chromeManager.getTabs(port);
                        const found = tabs && tabs.some((t: any) => t && t.url && String(t.url).includes(expectedUrl));
                        if (found) return true;
                    } catch (e) { /* ignore */ }
                }
            } catch (e) { /* swallow */ }

            // else timeout -> retry if attempts remain
            if (attempt < retries) await new Promise(r => setTimeout(r, retryDelayMs));
        }

        return false; // exhausted retries
    }

    // ─── OBSERVER MANAGEMENT ────────────────────────

    /** Start observer for account (only called when all flags are ready) */
    private async startObserverForAccount(account: string): Promise<void> {
        console.log(`[WORKER] 🎯 Starting observer for Account ${account}`);
        
        // The "observer" is essentially enabling data processing for this account
        // The actual processing happens in WorkerManager when stream_data is received
        // This method ensures the account is marked as active and ready to process data
        
        this.gateway.sendUpdate('system_log', {
            level: 'info',
            message: `[OBSERVER] Account ${account} observer started - pipeline ready`,
            timestamp: Date.now()
        });
    }

    /** Stop observer for account */
    private async stopObserverForAccount(account: string): Promise<void> {
        console.log(`[WORKER] 🛑 Stopping observer for Account ${account}`);
        
        // Stop any active processing for this account
        // The account will still receive events but won't process them as active
        
        this.gateway.sendUpdate('system_log', {
            level: 'info', 
            message: `[OBSERVER] Account ${account} observer stopped`,
            timestamp: Date.now()
        });
    }

    // ─── FSM TOGGLE LOGIC ───────────────────────────

    /** Handle toggle with atomic FSM transitions */
    private async handleToggleFsm(account: string, active: boolean): Promise<void> {
        const currentState = this.internalFsm.get(account);

        // 🛡️ FSM: Reject operations during transitional states
        if (currentState === ToggleState.STARTING || currentState === ToggleState.STOPPING) {
            console.log(`[FSM] 🚫 TOGGLE ${active ? 'ON' : 'OFF'} REJECTED for Account ${account} - In transitional state: ${currentState}`);
            const payload = { account, reason: 'TRANSITIONAL_STATE', state: currentState, ts: Date.now() };
            // notify UI / operator
            this.gateway.sendUpdate('system_log', {
                level: 'warn',
                message: `[FSM] Toggle ${active ? 'ON' : 'OFF'} rejected for ${account} - In transitional state: ${currentState}`,
                timestamp: Date.now()
            });
            // emit dedicated telemetry event for toggle failures
            try { this.gateway.sendUpdate('toggle:failed', payload); } catch (e) {}
            // append to wire log for post-mortem
            try { fs.appendFileSync(this.wireLog, JSON.stringify({ event: 'TOGGLE_FAILED', payload }) + '\n'); } catch (e) {}
            return;
        }

        if (active) {
            // TOGGLE ON: Only allowed from IDLE state
            if (currentState !== ToggleState.IDLE) {
                console.log(`[FSM] 🚫 TOGGLE ON REJECTED for Account ${account} - Invalid state: ${currentState}`);
                const payload = { account, reason: 'INVALID_STATE_FOR_ON', state: currentState, ts: Date.now() };
                try { this.gateway.sendUpdate('toggle:failed', payload); } catch (e) {}
                try { fs.appendFileSync(this.wireLog, JSON.stringify({ event: 'TOGGLE_FAILED', payload }) + '\n'); } catch (e) {}
                return;
            }

            // Check readiness before starting
            if (!this.chromeReady || !this.injectedReady || !this.cdpReady) {
                const missing = [];
                if (!this.chromeReady) missing.push('Chrome');
                if (!this.injectedReady) missing.push('Injected');
                if (!this.cdpReady) missing.push('CDP');

                console.log(`[FSM] 🚫 TOGGLE ON REJECTED for Account ${account} - Pipeline not ready: ${missing.join(', ')}`);
                const payload = { account, reason: 'PIPELINE_NOT_READY', missing, ts: Date.now() };
                this.gateway.sendUpdate('system_log', {
                    level: 'error',
                    message: `[FSM] Account ${account} toggle ON rejected - Pipeline not ready: ${missing.join(', ')}`,
                    timestamp: Date.now()
                });
                try { this.gateway.sendUpdate('toggle:failed', payload); } catch (e) {}
                try { fs.appendFileSync(this.wireLog, JSON.stringify({ event: 'TOGGLE_FAILED', payload }) + '\n'); } catch (e) {}
                return;
            }

            // FSM: IDLE → STARTING → RUNNING
            await this.transitionFsm(account, ToggleState.STARTING);
            try {
                await this.startObserverForAccount(account);
                await this.transitionFsm(account, ToggleState.RUNNING);
                console.log(`[FSM] ✅ Account ${account} observer started successfully`);
            } catch (error) {
                console.error(`[FSM] ❌ Account ${account} observer start failed:`, error);
                await this.transitionFsm(account, ToggleState.IDLE);
                throw error;
            }

        } else {
            // TOGGLE OFF: Only allowed from RUNNING state
            if (currentState !== ToggleState.RUNNING) {
                console.log(`[FSM] 🚫 TOGGLE OFF REJECTED for Account ${account} - Invalid state: ${currentState}`);
                const payload = { account, reason: 'INVALID_STATE_FOR_OFF', state: currentState, ts: Date.now() };
                try { this.gateway.sendUpdate('toggle:failed', payload); } catch (e) {}
                try { fs.appendFileSync(this.wireLog, JSON.stringify({ event: 'TOGGLE_FAILED', payload }) + '\n'); } catch (e) {}
                return;
            }

            // FSM: RUNNING → STOPPING → IDLE
            await this.transitionFsm(account, ToggleState.STOPPING);
            try {
                await this.stopObserverForAccount(account);
                await this.transitionFsm(account, ToggleState.IDLE);
                console.log(`[FSM] ✅ Account ${account} observer stopped successfully`);
            } catch (error) {
                console.error(`[FSM] ❌ Account ${account} observer stop failed:`, error);
                // On stop failure, still transition to IDLE to prevent stuck state
                await this.transitionFsm(account, ToggleState.IDLE);
                throw error;
            }
        }
    }

    /** Atomic FSM state transition */
    private async transitionFsm(account: string, newState: ToggleState): Promise<void> {
        const oldState = this.internalFsm.get(account);
        this.internalFsm.transition(account, newState as any);

        console.log(`[FSM] 🔄 Account ${account}: ${oldState} → ${newState}`);
        this.gateway.sendUpdate('fsm:transition', {
            account,
            fromState: oldState,
            toState: newState,
            timestamp: Date.now()
        });
    }

    constructor(
        @Inject(forwardRef(() => MarketService))
        private marketService: MarketService,
        private gateway: AppGateway,
        private redisService: RedisService,
        private sqliteService: SqliteService,
        private discoveryService: DiscoveryService,
        private pairingService: PairingService,
        private guardianService: ProviderGuardianService,
        private registry: ContractRegistry,
        private decoder: UniversalDecoderService,
        private providerManager: ProviderSessionManager,
        private chromeManager: ChromeConnectionManager,
        private commandRouter: CommandRouterService,
        private internalBus: InternalEventBusService,
        private internalFsm: InternalFsmService
    ) {
        // initialize runtime manager with shared FSM instance so transitions use same FSM
        this.runtimeManager = new (require('../runtime/account-runtime.manager').AccountRuntimeManager)(this.internalFsm)
        // 🛡️ Initialize Provider Session Manager
        // Already initialized in constructor

        // Subscription to Registry for ORCHESTRATION is now handled dynamically in orchestrateWorker

        // Initialize without worker subscriptions
    }

    async onModuleInit() {
        if (!fs.existsSync(this.wireLogDir)) fs.mkdirSync(this.wireLogDir, { recursive: true });
        this.logger.log(`🏗️ WorkerService v3.1 INITIALIZED (InstanceID: ${this.instanceId})`);
        
        // 🛡️ CRITICAL FIX: Chrome readiness will be set when browser automation attaches
        // Do not check Chrome on startup to avoid launching duplicate browsers
        
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

        // 🛡️ Listen for Chrome readiness
        this.gateway.trafficBus.on('chrome:ready', (data) => {
            if (data && data.port) {
                this.setChromeReady(true);
            }
        });

        console.log('[WORKER] Now listening for endpoint_captured events');

        // Register command ownership with CommandRouterService
        const registerHandler = (cmdType: string, handler: (c:any)=>Promise<any>|any) => {
            try {
                this.commandRouter.register(cmdType, async (c: any) => {
                    // Duplicate command guard
                    const commandKey = `${c.type}_${JSON.stringify(c.payload || {})}`;
                    const now = Date.now();
                    if (this.lastCommandTime[commandKey] && (now - this.lastCommandTime[commandKey]) < this.COMMAND_COOLDOWN) {
                        console.log(`[WORKER] 🚫 DUPLICATE COMMAND REJECTED: ${commandKey}`);
                        return;
                    }
                    this.lastCommandTime[commandKey] = now;
                    return handler(c)
                })
            } catch (e) { console.error('Register command failed', e) }
        }

        // Core ownerships
        registerHandler('TOGGLE_ACCOUNT', async (data) => {
            // Hard debug wrapper to prevent unhandled rejections/crashes — see COPILOT DEBUG PROMPT
            try {
                // Normalize payload shapes: allow { accountId, enabled } OR { account, active }
                const payload = data && data.payload ? data.payload : {};
                const accountIdRaw = payload.accountId ?? payload.account ?? payload.acc ?? null;
                const enabledRaw = (payload.enabled !== undefined) ? payload.enabled : (payload.active !== undefined ? payload.active : null);

                // Accept only 'A' or 'B' as canonical accountId
                const accountId = (typeof accountIdRaw === 'string') ? accountIdRaw.toUpperCase() : null;
                const enabled = Boolean(enabledRaw);

                if (!accountId || (accountId !== 'A' && accountId !== 'B')) {
                    console.error('[WORKER] TOGGLE_ACCOUNT received with invalid accountId:', accountIdRaw);
                    this.gateway.sendUpdate('system_log', { level: 'error', message: `[WORKER] Invalid TOGGLE_ACCOUNT payload: ${JSON.stringify(payload)}` });
                    return { success: false, error: 'invalid-account' };
                }

                // Ensure AccountRuntime exists immediately on receiving a TOGGLE request
                try {
                    const created = this.runtimeManager.get(accountId);
                    try { fs.appendFileSync(this.wireLog, JSON.stringify({ ts: Date.now(), event: 'RUNTIME_CREATED', account: accountId }) + '\n'); } catch (e) {}
                } catch (e) {
                    console.error('[WORKER] Failed to ensure AccountRuntime', e);
                }

                const ts = Date.now();
                console.log(`[WORKER] 🔄 TOGGLE_ACCOUNT: ${accountId} -> ${enabled ? 'ON' : 'OFF'} @ ${new Date(ts).toISOString()}`);

                // Diagnostic: write payload + lightweight stack + FSM snapshot to wire log for post-mortem
                try {
                    const safePayload = (() => {
                        try { return JSON.parse(JSON.stringify(data)); } catch (e) { return { note: 'unserializable payload' }; }
                    })();
                    const diag = {
                        ts,
                        event: 'TOGGLE_ACCOUNT',
                        instance: this.instanceId,
                        payload: safePayload,
                        fsmState: this.internalFsm ? this.internalFsm.get(accountId) : 'unknown',
                        stack: (new Error()).stack?.split('\n').slice(0,6).join('\n')
                    };
                    try {
                        fs.appendFileSync(this.wireLog, JSON.stringify(diag) + '\n');
                    } catch (e) {
                        console.error('[WORKER] Failed to append diagnostic wire log', e);
                    }
                } catch (e) {
                    console.error('[WORKER] Diagnostic logging failed', e);
                }

                try {
                    // Use the shared InternalFsmService directly to ensure the WorkerService
                    // is the visible caller in the stack (guard inside InternalFsmService).

                    // If enabling an account and a Whitelabel URL is configured, request
                    // the BrowserAutomationService to open/focus the provider tab first.
                    if (enabled) {
                        const targetUrl = accountId === 'A' ? this.config.urlA : this.config.urlB;

                        // Hardening B: validate whitelabel URL is configured before proceeding
                        if (!targetUrl || targetUrl.trim().length === 0) {
                            const payload = { account: accountId, reason: 'MISSING_WHITELABEL_URL', ts: Date.now() };
                            console.warn(`[WORKER] 🔒 TOGGLE ON rejected for ${accountId} - missing whitelabel URL`);
                            try { this.gateway.sendUpdate('toggle:failed', payload); } catch (e) {}
                            try { fs.appendFileSync(this.wireLog, JSON.stringify({ event: 'TOGGLE_FAILED', payload }) + '\n'); } catch (e) {}
                            return { success: false, error: 'missing-whitelabel' };
                        }

                        const requestId = `toggle-open-${accountId}-${Date.now()}`;

                        // Request browser open and fail fast if the internal bus publish errors
                        try {
                            this.internalBus.publish('REQUEST_OPEN_BROWSER', { account: accountId, url: targetUrl, requestId });
                            this.lastOpenedAccount = accountId;
                            this.lastOpenedTime = Date.now();
                            this.gateway.sendUpdate('system_log', { level: 'info', message: `[WORKER] Requested browser open for ${accountId} -> ${targetUrl}`, timestamp: Date.now() });
                            try { fs.appendFileSync(this.wireLog, JSON.stringify({ ts: Date.now(), event: 'REQUEST_OPEN_BROWSER_SENT', account: accountId, url: targetUrl, requestId }) + '\n'); } catch (e) {}
                        } catch (e) {
                            console.error('[WORKER] 🚨 Failed to request open browser (bus publish)', e);
                            const payload = { account: accountId, reason: 'REQUEST_OPEN_BROWSER_FAILED', error: (e && e.message) ? e.message : String(e), ts: Date.now() };
                            try { this.gateway.sendUpdate('toggle:failed', payload); } catch (e) {}
                            try { fs.appendFileSync(this.wireLog, JSON.stringify({ event: 'TOGGLE_FAILED', payload }) + '\n'); } catch (e) {}
                            return { success: false, error: 'request-open-failed' };
                        }

                        // First: wait for an explicit browser-open acknowledgement emitted by BrowserAutomationService
                        try {
                            const opened = await this.waitForBrowserOpen(accountId, { timeoutMs: 2000, retries: 2, retryDelayMs: 500 });
                            try { fs.appendFileSync(this.wireLog, JSON.stringify({ ts: Date.now(), event: 'BROWSER_OPEN_RESULT', account: accountId, opened }) + '\n'); } catch (e) {}
                            if (!opened) {
                                const payload = { account: accountId, reason: 'BROWSER_OPEN_TIMEOUT', ts: Date.now() };
                                console.warn(`[WORKER] 🔧 Browser did not report opened for ${accountId} — rejecting toggle`);
                                try { this.gateway.sendUpdate('toggle:failed', payload); } catch (e) {}
                                try { fs.appendFileSync(this.wireLog, JSON.stringify({ event: 'TOGGLE_FAILED', payload }) + '\n'); } catch (e) {}
                                // Harden: ensure FSM stays IDLE and mark provider RED
                                try { await this.transitionFsm(accountId, ToggleState.IDLE); } catch (e) {}
                                try { const ctx = this.accountContexts.get(accountId as any); if (ctx) ctx.providerStatus = 'RED'; } catch (e) {}
                                try { this.gateway.sendUpdate('system_log', { level: 'error', message: `[TOGGLE] Failed to open browser for ${accountId}` }); } catch (e) {}
                                return { success: false, error: 'browser-open-timeout' };
                            }
                        } catch (e) {
                            const payload = { account: accountId, reason: 'BROWSER_OPEN_WAIT_ERROR', error: (e && (e as Error).message) || String(e), ts: Date.now() };
                            try { this.gateway.sendUpdate('toggle:failed', payload); } catch (e) {}
                            try { fs.appendFileSync(this.wireLog, JSON.stringify({ event: 'TOGGLE_FAILED', payload }) + '\n'); } catch (e) {}
                            try { await this.transitionFsm(accountId, ToggleState.IDLE); } catch (e) {}
                            try { const ctx = this.accountContexts.get(accountId as any); if (ctx) ctx.providerStatus = 'RED'; } catch (e) {}
                            try { this.gateway.sendUpdate('system_log', { level: 'error', message: `[TOGGLE] Error waiting for browser open for ${accountId}` }); } catch (e) {}
                            return { success: false, error: 'browser-wait-error' };
                        }

                        // Then: Wait briefly (up to 5s) for Chrome readiness so FSM can proceed — if still not ready, reject toggle
                        const waitUntil = async (pred: () => boolean, timeout = 5000) => {
                            const start = Date.now();
                            while (Date.now() - start < timeout) {
                                if (pred()) return true;
                                await new Promise(r => setTimeout(r, 200));
                            }
                            return false;
                        };

                        try {
                            const ready = await waitUntil(() => this.chromeReady === true, 5000);
                            try { fs.appendFileSync(this.wireLog, JSON.stringify({ ts: Date.now(), event: 'CHROME_READY_AFTER_OPEN', account: accountId, ready }) + '\n'); } catch (e) {}
                            if (!ready) {
                                const payload = { account: accountId, reason: 'CHROME_NOT_READY_AFTER_OPEN', ts: Date.now() };
                                console.warn(`[WORKER] 🔧 Chrome not ready after open request for ${accountId} — rejecting toggle`);
                                try { this.gateway.sendUpdate('toggle:failed', payload); } catch (e) {}
                                try { fs.appendFileSync(this.wireLog, JSON.stringify({ event: 'TOGGLE_FAILED', payload }) + '\n'); } catch (e) {}
                                try { await this.transitionFsm(accountId, ToggleState.IDLE); } catch (e) {}
                                try { const ctx = this.accountContexts.get(accountId as any); if (ctx) ctx.providerStatus = 'RED'; } catch (e) {}
                                try { this.gateway.sendUpdate('system_log', { level: 'error', message: `[TOGGLE] Chrome not ready after open for ${accountId}` }); } catch (e) {}
                                return { success: false, error: 'chrome-not-ready' };
                            }
                        } catch (e) {
                            // treat unexpected errors as fatal for toggle
                            const payload = { account: accountId, reason: 'CHROME_WAIT_ERROR', error: (e && (e as Error).message) || String(e), ts: Date.now() };
                            try { this.gateway.sendUpdate('toggle:failed', payload); } catch (e) {}
                            try { fs.appendFileSync(this.wireLog, JSON.stringify({ event: 'TOGGLE_FAILED', payload }) + '\n'); } catch (e) {}
                            try { await this.transitionFsm(accountId, ToggleState.IDLE); } catch (e) {}
                            try { const ctx = this.accountContexts.get(accountId as any); if (ctx) ctx.providerStatus = 'RED'; } catch (e) {}
                            try { this.gateway.sendUpdate('system_log', { level: 'error', message: `[TOGGLE] Chrome wait error for ${accountId}` }); } catch (e) {}
                            return { success: false, error: 'chrome-wait-error' };
                        }

                        // Ensure FSM is IDLE before attempting transition
                        if (this.internalFsm.get(accountId) !== ToggleState.IDLE) return { success: false, error: 'invalid-fsm-state' };

                        // Request a one-time token and perform a trusted transition
                        try {
                            const t = this.internalFsm.issueToken();
                            this.internalFsm.trustedTransition(accountId, ToggleState.STARTING, t);

                            // Immediately complete STARTING -> RUNNING for the TOGGLE_ACCOUNT flow.
                            // This ensures a user-triggered toggle reaches RUNNING once browser open
                            // and readiness checks have passed (keeps behavior consistent with
                            // `handleToggleFsm` while preserving the trustedTransition guard).
                            try {
                                await this.startObserverForAccount(accountId);
                                await this.transitionFsm(accountId, ToggleState.RUNNING);
                                console.log(`[FSM] ✅ Account ${accountId} observer started (TOGGLE_ACCOUNT flow)`);
                                try { fs.appendFileSync(this.wireLog, JSON.stringify({ ts: Date.now(), event: 'TOGGLE_ACCOUNT_STARTED', account: accountId, fsm: 'RUNNING' }) + '\n'); } catch (e) {}
                                try { this.gateway.sendUpdate('system_log', { level: 'info', message: `[TOGGLE] Account ${accountId} moved to RUNNING (TOGGLE_ACCOUNT flow)`, timestamp: Date.now() }); } catch (e) {}
                            } catch (err2) {
                                console.error(`[FSM] ❌ Account ${accountId} observer start failed (TOGGLE_ACCOUNT flow):`, err2);
                                try { fs.appendFileSync(this.wireLog, JSON.stringify({ ts: Date.now(), event: 'TOGGLE_ACCOUNT_START_FAILED', account: accountId, error: String(err2) }) + '\n'); } catch (e) {}
                                // FSM hardening: ensure we don't stay in STARTING and set provider to RED
                                try { await this.transitionFsm(accountId, ToggleState.IDLE); } catch (e) { /* swallow */ }
                                try { const ctx = this.accountContexts.get(accountId as any); if (ctx) ctx.providerStatus = 'RED'; } catch (e) {}
                                try { this.gateway.sendUpdate('system_log', { level: 'error', message: `[TOGGLE] Observer start failed for ${accountId} - ${String(err2)}` }); } catch (e) {}
                                return { success: false, error: 'observer-start-failed' };
                            }
                        } catch (err) {
                            console.error('[WORKER] Trusted transition failed', err);
                            try { await this.transitionFsm(accountId, ToggleState.IDLE); } catch (e) { /* swallow */ }
                            try { const ctx = this.accountContexts.get(accountId as any); if (ctx) ctx.providerStatus = 'RED'; } catch (e) {}
                            try { this.gateway.sendUpdate('system_log', { level: 'error', message: `[TOGGLE] Trusted transition failed for ${accountId}` }); } catch (e) {}
                            return { success: false, error: 'trusted-transition-failed' };
                        }
                    } else {
                        if (this.internalFsm.get(accountId) !== ToggleState.RUNNING) return { success: false, error: 'not-running' };
                        try {
                            const t = this.internalFsm.issueToken();
                            this.internalFsm.trustedTransition(accountId, ToggleState.STOPPING, t);
                        } catch (err) {
                            console.error('[WORKER] Trusted transition failed', err);
                            try { this.gateway.sendUpdate('system_log', { level: 'error', message: `[TOGGLE] Trusted transition failed during STOP for ${accountId}` }); } catch (e) {}
                            return { success: false, error: 'trusted-transition-failed' };
                        }
                    }
                } catch (e) {
                    console.error(`[WORKER] FSM transition failed: ${(e as Error).message}`);
                    // FSM safety: ensure we are not left in STARTING
                    try { await this.transitionFsm(accountId, ToggleState.IDLE); } catch (err) { /* swallow */ }
                    try { const ctx = this.accountContexts.get(accountId as any); if (ctx) ctx.providerStatus = 'RED'; } catch (err) {}
                    try { this.gateway.sendUpdate('system_log', { level: 'error', message: `[TOGGLE] FSM failed for ${accountId}: ${(e as Error).message}` }); } catch (err) {}
                    return { success: false, error: 'fsm-failed' };
                }

                // keep existing config behavior in sync
                if (accountId === 'A') {
                    this.config.accountA_active = !!enabled;
                    if (!enabled) this.resetAccount('A');
                }
                if (accountId === 'B') {
                    this.config.accountB_active = !!enabled;
                    if (!enabled) this.resetAccount('B');
                }
                try { await this.redisService.setConfig(this.config) } catch (e) {}
                this.broadcastStatus();
                return { success: true };
            } catch (err: any) {
                // Top-level guard: ensure TOGGLE cannot crash the process
                console.error('[TOGGLE_ACCOUNT_FATAL]', err);
                try { (this.internalBus as any).emit && (this.internalBus as any).emit('system_log', { level: 'error', source: 'TOGGLE_ACCOUNT', message: err?.message || 'Unknown error', stack: err?.stack }); } catch (e) {}
                // FSM safety: try to recover account(s)
                try { if (err && err.account) { await this.transitionFsm(err.account, ToggleState.IDLE); const ctx = this.accountContexts.get(err.account); if (ctx) ctx.providerStatus = 'RED'; } } catch (e) {}
                return { success: false, error: err && err.message ? err.message : String(err) };
            }
        })

        registerHandler('GET_STATUS', async () => { this.broadcastStatus(); })

        registerHandler('UPDATE_CONFIG', async (data) => { this.config = { ...this.config, ...data.payload }; try { await this.redisService.setConfig(this.config) } catch (e){}; this.broadcastStatus(); })

        // MARK_PROVIDER: persist provider contract (SQLite) and attach to AccountContext
        registerHandler('MARK_PROVIDER', async (data) => {
            try {
                const payload = data && data.payload ? data.payload : {};
                const account = (String(payload.accountId || payload.account || '').toUpperCase() === 'B') ? 'B' : 'A';
                if (account !== 'A' && account !== 'B') return { success: false, error: 'invalid-account' };

                const existing = this.sqliteService.getProviderContractForAccount(account as any);
                if (existing) {
                    return { success: false, error: 'contract-already-exists' };
                }

                const row = {
                    accountId: account as any,
                    endpointPattern: String(payload.endpointPattern || '').trim(),
                    method: String(payload.method || 'GET').toUpperCase(),
                    requestSchema: payload.requestSchema ? JSON.stringify(payload.requestSchema) : null,
                    responseSchema: payload.responseSchema ? JSON.stringify(payload.responseSchema) : null,
                } as any;

                if (!row.endpointPattern) return { success: false, error: 'missing-endpointPattern' };

                this.sqliteService.saveProviderContract(row);

                // attach to account context (complete isolation per-account)
                const ctx = this.accountContexts.get(account as any);
                ctx.providerContract = { endpointPattern: row.endpointPattern, method: row.method, requestSchema: payload.requestSchema || null, responseSchema: payload.responseSchema || null, assignedAt: Date.now() };
                ctx.providerStatus = 'GREEN';

                // Activity log to UI (separate channel)
                try { this.gateway.sendUpdate('activity_log', { ts: Date.now(), event: 'provider:marked', account, endpointPattern: row.endpointPattern }); } catch (e) {}

                // ensure registry is aware (legacy compatibility)
                try { (this.registry as any).registerProviderForAccount && (this.registry as any).registerProviderForAccount(account as any, row.endpointPattern); } catch (e) {}

                // emit updated contracts to frontend
                try { this.gateway.sendUpdate('provider_contracts', { A: this.sqliteService.getProviderContractForAccount('A'), B: this.sqliteService.getProviderContractForAccount('B') }); } catch (e) {}

                return { success: true, assignedTo: account };
            } catch (e: any) {
                return { success: false, error: e && e.message ? e.message : String(e) };
            }
        })

        // LIST_PROVIDER_CONTRACTS: emit persisted contracts for accounts A/B
        registerHandler('LIST_PROVIDER_CONTRACTS', async () => {
            try {
                const a = this.sqliteService.getProviderContractForAccount('A');
                const b = this.sqliteService.getProviderContractForAccount('B');
                this.gateway.sendUpdate('provider_contracts', { A: a, B: b });
                return { success: true, A: a, B: b };
            } catch (e: any) {
                return { success: false, error: (e && e.message) ? e.message : String(e) };
            }
        })

        // DELETE_PROVIDER_CONTRACT: remove persisted contract and reset AccountContext
        registerHandler('DELETE_PROVIDER_CONTRACT', async (data) => {
            try {
                const account = (String(data?.payload?.accountId || data?.payload?.account || 'A') === 'B') ? 'B' : 'A';
                this.sqliteService.deleteProviderContractForAccount(account as any);
                try { (this.accountContexts as any).reset(account as any); } catch (e) {}
                try { this.gateway.sendUpdate('activity_log', { ts: Date.now(), event: 'provider:deleted', account }); } catch (e) {}
                try { this.gateway.sendUpdate('provider_contracts', { A: this.sqliteService.getProviderContractForAccount('A'), B: this.sqliteService.getProviderContractForAccount('B') }); } catch (e) {}
                return { success: true };
            } catch (e: any) {
                return { success: false, error: (e && e.message) ? e.message : String(e) };
            }
        })

        // GET_EXECUTION_HISTORY: fetch persisted execution_history from SQLite and emit
        registerHandler('GET_EXECUTION_HISTORY', async (data) => {
            try {
                const limit = (data && data.payload && data.payload.limit) ? Number(data.payload.limit) : 100;
                const rows = this.sqliteService.getExecutionHistory(limit);
                this.gateway.sendUpdate('execution_history_db', rows);
                return { success: true, rows };
            } catch (e: any) {
                return { success: false, error: (e && e.message) ? e.message : String(e) };
            }
        })

        registerHandler('LOG_OPPS', async (data) => { console.log('[WORKER] [LOG_OPPS] Received telemetry payload'); try{ this.gateway.sendUpdate('debug:opps', { payload: data.payload, ts: Date.now() }) }catch(e){} })

        // Misc / convenience commands still owned by WorkerService
        registerHandler('toggle_on', async () => { if (this.internalFsm.get('A') !== ToggleState.IDLE && this.internalFsm.get('B') !== ToggleState.IDLE) return; await this.handleToggleFsm('A', true); await this.handleToggleFsm('B', true); this.config.accountA_active = true; this.config.accountB_active = true; this.broadcastStatus() })
        registerHandler('toggle_off', async () => { await this.handleToggleFsm('A', false); await this.handleToggleFsm('B', false); this.config.accountA_active = false; this.config.accountB_active = false; this.broadcastStatus() })

        registerHandler('FORCE_RESET', async () => { this.discoveryService.clearAllMemory(); this.gateway.sendUpdate('system_log', { level: 'warn', message: '[SYSTEM] Discovery registry wiped. Awaiting fresh data pulses.' }) })

        registerHandler('PANIC_STOP', async () => { this.emergencyStop() })

        registerHandler('FORCE_ACTIVATE', async () => {
            const connCount = (this.gateway.server as any)?.clients?.size || 0;
            const msg = `[WORKER] 🚀 FORCE_RECOVERY: Requesting ACTIVATE_MARKET_AUTO (Conns: ${connCount})`;
            console.log(msg);
            try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
            // Ask BrowserAutomationService to emit browser-level command
            this.internalBus.publish('REQUEST_BROWSER_CMD', { command: 'ACTIVATE_MARKET_AUTO', account: 'ALL' });
        })

        registerHandler('ENABLE_DEBUG', async () => { const msg = `[WORKER] 🐞 DEBUG MODE ENABLED (60s)`; console.log(msg); try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { } (this as any).tempDebug = true; setTimeout(()=>{(this as any).tempDebug=false; const msgOff=`[WORKER] 🐞 DEBUG MODE DISABLED`; console.log(msgOff); try{ fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msgOff}\n`); }catch(e){} },60000) })

        registerHandler('HARD_RECOVERY', async () => {
            console.log('🚨 [HARD-RECOVERY] Executing memory purge and fresh pull...');
            this.discoveryService.clearAllMemory();
            this.resetAccount('A');
            this.resetAccount('B');
            this.internalBus.publish('REQUEST_BROWSER_CMD', { command: 'ACTIVATE_MARKET_AUTO', account: 'ALL' });
            const scrapeScript = `...`;
            this.internalBus.publish('REQUEST_BROWSER_CMD', { command: 'EXECUTE_SCRIPT', script: scrapeScript });
            this.gateway.sendUpdate('system_log', { level: 'info', message: '🚀 Hard Recovery: Registries purged, re-syncing from browsers...' });
        })

        registerHandler('BYPASS_FILTERS', async () => { const msg = `[WORKER] 🔓 FILTER BYPASS ENABLED (600s)`; console.log(msg); try{ fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msg}\n`); }catch(e){} this.discoveryService.setBypass(true); setTimeout(()=>{ this.discoveryService.setBypass(false); const msgOff=`[WORKER] 🔒 FILTER BYPASS DISABLED`; console.log(msgOff); try{ fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${msgOff}\n`); }catch(e){} },600000) })
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

        // Update providerStatus per AccountContext (YELLOW if no traffic for 5s; RED if stale/none)
        try {
            const now = Date.now();
            for (const ctx of (this.accountContexts as any).getAll()) {
                if (!ctx.providerContract) {
                    ctx.providerStatus = 'RED';
                    ctx.oddsStreamActive = false;
                    continue;
                }
                const last = ctx.lastTrafficAt || 0;
                const age = now - last;
                if (last === 0) {
                    ctx.providerStatus = 'YELLOW';
                    ctx.oddsStreamActive = false;
                } else if (age <= 5000) {
                    ctx.providerStatus = 'GREEN';
                    ctx.oddsStreamActive = true;
                } else if (age > 5000 && age <= 30000) {
                    ctx.providerStatus = 'YELLOW';
                    ctx.oddsStreamActive = false;
                } else {
                    ctx.providerStatus = 'RED';
                    ctx.oddsStreamActive = false;
                }
            }
        } catch (e) { /* swallow */ }

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

            // �️ CRITICAL FIX: Set readiness flags on first events
            const eventSource = data.source;
            if (eventSource === 'injected' && !this.injectedReady) {
                this.setInjectedReady(true);
            } else if (eventSource === 'cdp' && !this.cdpReady) {
                this.setCdpReady(true);
            }

            // �🔍 Diagnostic: Raw Payload Logging (v3.2)
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

            // If a user-defined provider contract exists for this account, enforce it (strict filtering)
            try {
                const ctx = this.accountContexts.get(account as any);
                if (ctx && ctx.providerContract) {
                    const pattern = String(ctx.providerContract.endpointPattern || '').toLowerCase();
                    if (pattern && url.indexOf(pattern) === -1) {
                        // Not relevant to this account's contract — ignore
                        return;
                    }

                    // matched contract — update last seen / stream active
                    ctx.lastTrafficAt = Date.now();
                    ctx.oddsStreamActive = true;
                    ctx.providerStatus = 'GREEN';
                    try { fs.appendFileSync(this.wireLog, JSON.stringify({ ts: Date.now(), event: 'CONTRACT_MATCH', account, url: url.substring(0,200) }) + '\n'); } catch (e) {}
                    this.broadcastStatus();
                }
            } catch (e) { /* swallow */ }

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
                        console.log(`[OBSERVE] Odds parsing failed for AFB88 - no odds extracted from payload`);
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
                        console.log(`[OBSERVE] Odds parsing failed for SABA - attempting fallback parsers`);
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
                
                // 🛡️ Report to ProviderSessionManager (manager decides state)
                const slotKey = this.getSlotKeyForProvider(account, verifiedProvider);
                if (slotKey) {
                    this.providerManager.reportEvent(slotKey, 'ODDS_RECEIVED', {
                        providerType: verifiedProvider,
                    });
                }
                
                const streamMsg = `[STREAM] 🌊 Processed ${parsedResult.odds.length} odds for ${regKey}`;
                console.log(streamMsg);
                console.log(`[OBSERVE] Odds visibility confirmed - ${parsedResult.odds.length} odds processed for ${regKey}`);
                try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${streamMsg}\n`); } catch (e) { }
                await this.processOddsBatch(account, verifiedProvider, parsedResult.odds, data.clientId);
            }

            if (parsedResult.balance !== null) {
                this.balance[account] = parsedResult.balance.toFixed(2);
                
                // 🛡️ Report balance to ProviderSessionManager
                for (let i = 1; i <= 5; i++) {
                    const slotKey = `${account}${i}`;
                    this.providerManager.reportEvent(slotKey, 'BALANCE_RECEIVED', {
                        balance: this.balance[account],
                    });
                }
                
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
                    
                    // 🛡️ Report guardian state to ProviderSessionManager
                    if (finalState === 'LIVE') {
                        this.providerManager.reportEvent(key, 'ODDS_RECEIVED', { providerType: providerName });
                    } else if (finalState === 'HEARTBEAT_ONLY' || finalState === 'DEAD') {
                        this.providerManager.reportEvent(key, 'DATA_STALE', { providerType: providerName });
                    } else {
                        this.providerManager.reportEvent(key, 'RESET');
                    }
                } else {
                    this.providerStatus[key] = 'INACTIVE';
                    
                    // 🛡️ Report to ProviderSessionManager
                    this.providerManager.reportEvent(key, 'RESET');
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
            activePairs: (this.config.accountA_active && this.config.accountB_active) ? discoveryStats.confirmedPairs : 0,
            // Add AccountContext summary for UI (non-breaking additive field)
            accountContexts: {
                A: {
                    url: (this.accountContexts as any).get('A').url || this.config.urlA || '',
                    providerStatus: (this.accountContexts as any).get('A').providerStatus,
                    oddsStreamActive: (this.accountContexts as any).get('A').oddsStreamActive
                },
                B: {
                    url: (this.accountContexts as any).get('B').url || this.config.urlB || '',
                    providerStatus: (this.accountContexts as any).get('B').providerStatus,
                    oddsStreamActive: (this.accountContexts as any).get('B').oddsStreamActive
                }
            }
        });

        const statusMsg = `[STATUS-SYNC] ID=${this.instanceId} Broadcasting A_active=${this.config.accountA_active} B_active=${this.config.accountB_active}`;
        try { fs.appendFileSync(this.wireLog, `[${new Date().toISOString()}] ${statusMsg}\n`); } catch (e) { }
        // --- Also emit full backend_state for frontend consumption (keeps UI authoritative sync)
        try {
            const accounts = this.runtimeManager.getAll().map(r => ({
                accountId: r.accountId,
                fsm: r.getState()
            }));

            this.gateway.sendUpdate('backend_state', { accounts });
        } catch (e) {
            // non-fatal
        }
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
        
        // 🛡️ Reset ProviderSessionManager
        this.providerManager.resetAccountProviders(account as 'A' | 'B');

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

        // 8. Remove persisted provider contract (SQLite) and reset AccountContext
        try { this.sqliteService && this.sqliteService.deleteProviderContractForAccount(account as any); } catch (e) {}
        try { (this.accountContexts as any).reset(account as any); } catch (e) {}

        // 9. Request browser teardown for account (single tab guarantee)
        try { this.internalBus.publish('REQUEST_CLOSE_BROWSER', { account }); } catch (e) {}

        this.broadcastStatus();

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
        
        // 🛡️ Reset ProviderSessionManager
        this.providerManager.forceResetAll();

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

    /**
     * Get the slot key (A1, A2, etc.) for a provider
     */
    private getSlotKeyForProvider(account: string, provider: string): string | null {
        const slots = this.providerSlots[account];
        if (!slots) return null;
        
        const index = slots.indexOf(provider);
        if (index === -1) return null;
        
        return `${account}${index + 1}`;
    }
}

