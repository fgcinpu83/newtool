import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppGateway } from '../gateway.module';
import { DiscoveryService } from '../discovery/discovery.service';
import { PairingService } from '../pairing/pairing.service';
import { WorkerService } from '../workers/worker.service';
import { MarketService } from '../market/market.service';
import { ProviderGuardianService } from '../guardian/provider-guardian.service';

/**
 * PIPELINE HEALTH MONITOR - CONTROL TOWER
 * 
 * NOT just an indicator - this is the ENGINE AUTHORITY.
 * 
 * RESPONSIBILITIES:
 * 1. Monitor all pipeline layers in real-time
 * RULES:
 * - GREEN: All layers active & flowing
 * - YELLOW: Partial flow or idle
 * - RED: System not ready
 */

export interface SystemHealth {
    status: 'GREEN' | 'YELLOW' | 'RED';
    layers: {
        provider: 'OK' | 'NO_DATA' | 'DISCONNECTED' | 'RECOVERING';
        normalization: 'OK' | 'IDLE' | 'ERRORS';
        discovery: 'OK' | 'NO_BINDINGS' | 'IDLE';
        pairing: 'OK' | 'NO_PAIRS' | 'IDLE';
        arbitrage: 'OK' | 'IDLE' | 'BLOCKED';
    };
    counts: {
        rawEvents: number;
        normalizedEvents: number;
        activeBindings: number;
        activePairs: number;
        arbOpportunities: number;
        activeProviders: number;
    };
    reason: string;
    dataFreshness: number; // seconds since last data
}

// Recovery state tracker
@Injectable()
export class HealthMonitorService implements OnModuleInit {
    private readonly logger = new Logger(HealthMonitorService.name);
    private ticks = 0;

    onModuleInit() {
        this.logger.log('HealthMonitorService STARTED');
        this.logToDisk('HealthMonitorService STARTED');
    }

    constructor(
        private gateway: AppGateway,
        @Optional() private discovery: DiscoveryService,
        @Optional() private pairing: PairingService,
        @Optional() private worker: WorkerService,
        @Optional() private market: MarketService,
        @Optional() private guardian: ProviderGuardianService
    ) { }

    private getDiscoveryStats() {
        if (this.discovery && typeof this.discovery.getStats === 'function') return this.discovery.getStats();
        return { registryASize: 0, registryBSize: 0, confirmedPairs: 0 } as any;
    }

    private getPairingStats() {
        if (this.pairing && typeof this.pairing.getStats === 'function') return this.pairing.getStats();
        return { totalBufferedEvents: 0, activePairs: 0, arbOpportunities: 0, totalPairs: 0 } as any;
    }

    private getMarketStats() {
        if (this.market && typeof this.market.getStats === 'function') return this.market.getStats();
        return { totalNormalized: 0 } as any;
    }

    private getGuardianStatus() {
        if (this.guardian && typeof this.guardian.getAllStatus === 'function') return this.guardian.getAllStatus();
        return new Map();
    }

    private getWorkerProviderStatuses() {
        if (this.worker && typeof this.worker.getAllProviderStatuses === 'function') return this.worker.getAllProviderStatuses();
        return [] as any[];
    }

    @Cron(CronExpression.EVERY_5_SECONDS)
    handleHealthCheck() {
        const health = this.evaluateRawHealth();

        // Broadcast to UI
        this.gateway.sendUpdate('health:pipeline', health);

        // FORENSIC STABILITY REPORT (Mandatory - Every 30s)
        this.ticks++;
        if (this.ticks >= 6) {
            this.logStabilityReport(health);
            this.ticks = 0;
        }
    }

    private logToDisk(msg: string) {
        try {
            const fs = require('fs');
            const path = require('path');
            fs.appendFileSync(path.join(process.cwd(), 'forensic_debug.log'), `[${new Date().toISOString()}] ${msg}\n`);
        } catch (e) { }
    }

    private logStabilityReport(health: SystemHealth) {
        // [STABILITY-REPORT] 
        // providersLive: X providerLastSeen: {...} events: Y bindings: Z registryA: A registryB: B healthState: GREEN

        const providerStatus = this.getWorkerProviderStatuses();
        const discoveryStats = this.getDiscoveryStats();

        const bornCount = (this.worker as any).getBornCount?.() || 0;
        const msg = `[STABILITY-REPORT] health=${health.status} reason=${health.reason} ` +
            `live=${health.counts.activeProviders} born=${bornCount} ` +
            `events=${health.counts.rawEvents} ` +
            `bindings=${health.counts.activeBindings} ` +
            `pairs=${health.counts.activePairs} ` +
            `arb=${health.counts.arbOpportunities} ` +
            `regA=${discoveryStats.registryASize} regB=${discoveryStats.registryBSize} ` +
            `dataFreshness=${health.dataFreshness}s`;

        this.logger.log(msg);
        this.logToDisk(msg);
    }


    /**
     * Enter pairing audit mode - analyze why pairs aren't forming
     */
    private enterPairingAuditMode() {
        this.logger.log('[CONTROL] === PAIRING AUDIT MODE ===');

        const discoveryStats = this.getDiscoveryStats();
        const pairingStats = this.getPairingStats();

        this.logger.log(`[AUDIT] Registry A: ${discoveryStats.registryASize}`);
        this.logger.log(`[AUDIT] Registry B: ${discoveryStats.registryBSize}`);
        this.logger.log(`[AUDIT] Confirmed Pairs: ${discoveryStats.confirmedPairs}`);
        this.logger.log(`[AUDIT] Buffered Events: ${pairingStats.totalBufferedEvents}`);
        this.logger.log(`[AUDIT] Active Pairs: ${pairingStats.activePairs}`);

        // Emit audit data to frontend for visibility
        this.gateway.sendUpdate('health:audit', {
            mode: 'PAIRING_AUDIT',
            discovery: discoveryStats,
            pairing: pairingStats,
            timestamp: Date.now()
        });

        // Analysis hints
        if (discoveryStats.confirmedPairs === 0) {
            this.logger.warn('[AUDIT] ⚠️ No confirmed bindings - Check if events from A and B are matching');
        } else if (pairingStats.totalBufferedEvents > 0 && pairingStats.activePairs === 0) {
            this.logger.warn('[AUDIT] ⚠️ Events buffered but no pairs - Check line/side matching rules');
        }
    }

    private evaluateRawHealth(): SystemHealth {
        // 1. ENGINE SOURCES (SOURCE OF TRUTH)
        const guardianStatus = this.getGuardianStatus();
        const discoveryStats = this.getDiscoveryStats();
        const pairingStats = this.getPairingStats();
        const marketStats = this.getMarketStats();

        // 2. PROVIDER LIVENESS CHECK (Guardian)
        let hasDeadProvider = false;
        let activeProviders = 0;
        let providerLayerState: 'OK' | 'DISCONNECTED' | 'NO_DATA' = 'DISCONNECTED';

        for (const [key, entry] of guardianStatus.entries()) {
            // Strictly check LIVENESS states only
            if (entry.state === 'DEAD') {
                hasDeadProvider = true;
            } else if (['LIVE', 'HEARTBEAT_ONLY', 'CONNECTED', 'SESSION_BOUND'].includes(entry.state)) {
                activeProviders++;
            }
        }

        if (activeProviders > 0) providerLayerState = 'OK';

        // 3. BINDING INTEGRITY CHECK
        const verifiedBindings = discoveryStats.confirmedPairs;
        const totalBindings = discoveryStats.confirmedPairs;

        // 4. CONSTRUCT BASE RESPONSE
        const response: SystemHealth = {
            status: 'RED',
            layers: {
                provider: providerLayerState,
                normalization: marketStats.totalNormalized > 0 ? 'OK' : 'IDLE',
                discovery: totalBindings > 0 ? 'OK' : 'IDLE',
                pairing: pairingStats.activePairs > 0 ? 'OK' : 'IDLE',
                arbitrage: 'IDLE'
            },
            counts: {
                rawEvents: discoveryStats.registryASize + discoveryStats.registryBSize,
                normalizedEvents: marketStats.totalNormalized,
                activeBindings: discoveryStats.confirmedPairs,
                activePairs: pairingStats.activePairs,
                arbOpportunities: pairingStats.arbOpportunities,
                activeProviders: activeProviders
            },
            reason: 'INITIALIZING',
            dataFreshness: 0
        };

        // === 5. STRICT DETERMINISTIC HEALTH LOGIC (PRIORITY BASED) ===
        // We do NOT use timestamps here. We rely on the States set by the Guards.

        // PRIORITY 1: SYSTEM IS PROCESSING (VERIFIED BINDINGS EXIST)
        // Rule: "Jika masih ada VERIFIED binding -> sistem TIDAK BOLEH RED walau ada provider mati."
        if (verifiedBindings > 0) {
            response.status = 'GREEN';
            response.reason = hasDeadProvider
                ? 'OPERATIONAL_WITH_DEAD_PROVIDER'
                : 'SYSTEM_OPTIMAL';
            response.layers.discovery = 'OK';

            // Sub-status for Pairing
            if (pairingStats.activePairs === 0) {
                response.layers.pairing = 'NO_PAIRS';
            }
            return response;
        }


        // PRIORITY 3: SYSTEM IS WAITING (PROVIDERS LIVE but NO BINDINGS)
        // Typical Startup or Low Market Activity
        if (activeProviders > 0) {
            // BUSINESS HEALTH CHECK:
            // If we have 2+ providers but NO PAIRS for a sustained period, the system is technically "healthy" 
            // but business-wise "failing" (no arb flow).
            if (activeProviders >= 2 && pairingStats.activePairs === 0) {
                // We rely on the fact that this state persists.
                // Immediate check is fine because "activePairs" should populate quickly if flow is real.
                response.status = 'YELLOW';
                response.reason = 'NO_ARBITRAGE_FLOW';
                response.layers.pairing = 'NO_PAIRS';
                return response;
            }

            response.status = 'YELLOW';
            response.reason = 'WAITING_FOR_MATCHES';
            response.layers.discovery = 'IDLE';
            return response;
        }

        // PRIORITY 4: SYSTEM IS DEAD
        // Rule: "semua provider DEAD / semua binding EXPIRED -> RED"
        // Also captures "RED jika ... tidak ada satupun VERIFIED" (implied failure of above)
        response.status = 'RED';
        response.reason = hasDeadProvider ? 'ALL_PROVIDERS_DEAD' : 'NO_ACTIVE_PROVIDERS';
        response.layers.provider = 'DISCONNECTED';

        return response;
    }
}
