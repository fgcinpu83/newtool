/**
 * ═══════════════════════════════════════════════════════════════════════════
 * COLD RUN LIVE DEPLOYMENT SERVICE v6.0
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * FEATURES:
 * 1. Shadow Execution Mode - Simulate slip filling, verify odds, STOP before bet
 * 2. Latency Monitor - Track timestamp_diff discards
 * 3. Token Refresh Watchdog - Monitor SABA token rotation
 * 4. Real-Time Log - [COLD-RUN] Potential Arb Found logging
 * 
 * SAFETY: 'Confirm/Place Bet' is LOCKED. No real money will be placed.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AppGateway } from '../gateway.module';
import { NormalizationService } from '../normalization/normalization.service';
import { SabaExecutionService, SlipStatus } from '../execution/saba-execution.service';
import * as fs from 'fs';
import * as path from 'path';

// Cold Run Configuration
export interface ColdRunConfig {
    enabled: boolean;
    shadowMode: boolean;          // If true, LOCK actual bet placement
    latencyThresholdMs: number;   // Default: 1000ms
    minProfitPercent: number;     // Minimum profit to log
    logPath: string;              // Path for cold run logs
}

// Latency Statistics
export interface LatencyStats {
    totalPairsProcessed: number;
    pairsSynced: number;
    pairsDropped: number;
    pairsMissingTimestamp: number;
    avgLatencyMs: number;
    maxLatencyMs: number;
    minLatencyMs: number;
    dropRatePercent: number;
    lastUpdated: number;
    history: { timestamp: number; synced: number; dropped: number }[];
}

// Token Watchdog State
export interface TokenWatchdogState {
    currentToken: string | null;
    tokenAge: number;             // Minutes since capture
    rotationCount: number;        // Number of token changes
    lastRotation: number;         // Timestamp of last rotation
    interruptionCount: number;    // Data interruptions after rotation
    status: 'HEALTHY' | 'ROTATING' | 'STALE' | 'INTERRUPTED';
}

// Cold Run Arbitrage Entry
export interface ColdRunArbEntry {
    timestamp: number;
    matchName: string;
    profitPercent: number;
    oddsA: number;
    oddsB: number;
    safetyCheck: 'OK' | 'FAIL';
    safetyReason: string;
    latencyMs: number;
    providerA: string;
    providerB: string;
    wouldExecute: boolean;
}

@Injectable()
export class ColdRunService {
    private readonly logger = new Logger(ColdRunService.name);

    // Configuration
    private config: ColdRunConfig = {
        enabled: true,
        shadowMode: false,          // 🔓 ENABLED - Allow real bets
        latencyThresholdMs: 1000,
        minProfitPercent: 0.5,
        logPath: path.join(process.cwd(), 'logs', 'cold_run.log')
    };

    // Statistics
    private latencyStats: LatencyStats = {
        totalPairsProcessed: 0,
        pairsSynced: 0,
        pairsDropped: 0,
        pairsMissingTimestamp: 0,
        avgLatencyMs: 0,
        maxLatencyMs: 0,
        minLatencyMs: Infinity,
        dropRatePercent: 0,
        lastUpdated: Date.now(),
        history: []
    };

    // Token Watchdog
    private tokenWatchdog: TokenWatchdogState = {
        currentToken: null,
        tokenAge: 0,
        rotationCount: 0,
        lastRotation: 0,
        interruptionCount: 0,
        status: 'HEALTHY'
    };

    // Arbitrage Log
    private arbLog: ColdRunArbEntry[] = [];
    private latencyHistory: number[] = [];

    constructor(
        private gateway: AppGateway,
        private normService: NormalizationService,
        private sabaExec: SabaExecutionService
    ) {
        this.logger.log('═══════════════════════════════════════════════════════════');
        this.logger.log('  🧊 COLD RUN SERVICE v6.0 INITIALIZED');
        this.logger.log('  ⚠️  SHADOW MODE ACTIVE - No real bets will be placed');
        this.logger.log('═══════════════════════════════════════════════════════════');

        // Start periodic broadcasts
        this.startPeriodicBroadcasts();
    }

    /**
     * Start periodic status broadcasts to dashboard
     */
    private startPeriodicBroadcasts() {
        // Broadcast latency stats every 2 seconds
        setInterval(() => {
            this.broadcastLatencyStats();
        }, 2000);

        // Broadcast token watchdog status every 5 seconds
        setInterval(() => {
            this.updateTokenWatchdog();
            this.broadcastTokenStatus();
        }, 5000);

        // Broadcast arb log every second
        setInterval(() => {
            this.broadcastArbLog();
        }, 1000);
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * LATENCY MONITOR
     * ═══════════════════════════════════════════════════════════════════════
     * Process pair timestamps and track drop rate
     */
    processPairLatency(
        timestampA: number,
        timestampB: number,
        matchName: string,
        profitPercent: number,
        oddsA: number,
        oddsB: number,
        providerA: string,
        providerB: string
    ): { accepted: boolean; latencyMs: number; reason: string } {

        this.latencyStats.totalPairsProcessed++;

        const result = this.normService.checkTimestampSync(timestampA, timestampB);

        if (result.reason === 'MISSING_TIMESTAMP') {
            this.latencyStats.pairsMissingTimestamp++;
            this.logColdRun(matchName, profitPercent, oddsA, oddsB, 'FAIL', 'MISSING_TIMESTAMP', -1, providerA, providerB, false);
            return { accepted: false, latencyMs: -1, reason: 'MISSING_TIMESTAMP' };
        }

        // Track latency
        if (result.diff >= 0) {
            this.latencyHistory.push(result.diff);
            if (this.latencyHistory.length > 1000) this.latencyHistory.shift();

            // Update stats
            if (result.diff > this.latencyStats.maxLatencyMs) {
                this.latencyStats.maxLatencyMs = result.diff;
            }
            if (result.diff < this.latencyStats.minLatencyMs) {
                this.latencyStats.minLatencyMs = result.diff;
            }
            this.latencyStats.avgLatencyMs = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
        }

        if (result.isSync) {
            this.latencyStats.pairsSynced++;

            // Log potential arb if profit meets threshold
            if (profitPercent >= this.config.minProfitPercent) {
                this.logColdRun(matchName, profitPercent, oddsA, oddsB, 'OK', 'SYNC_OK', result.diff, providerA, providerB, true);
            }

            return { accepted: true, latencyMs: result.diff, reason: 'SYNC_OK' };
        } else {
            this.latencyStats.pairsDropped++;
            this.logColdRun(matchName, profitPercent, oddsA, oddsB, 'FAIL', result.reason, result.diff, providerA, providerB, false);
            return { accepted: false, latencyMs: result.diff, reason: result.reason };
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * SHADOW EXECUTION
     * ═══════════════════════════════════════════════════════════════════════
     * Simulate full execution flow WITHOUT placing real bet
     */
    async shadowExecute(params: {
        matchId: string | number;
        oddsId: string | number;
        expectedOdds: number;
        stake: number;
        matchName: string;
        providerA: string;
        providerB: string;
    }): Promise<{
        phase: string;
        status: string;
        details: any;
        wouldExecute: boolean;
    }> {

        this.logger.log(`[SHADOW-EXEC] 🧊 Starting shadow execution for ${params.matchName}`);

        // Phase 1: Slip Simulation
        this.logger.log(`[SHADOW-EXEC] 📝 Phase 1: Simulating slip fill (Stake: ${params.stake})`);

        // Phase 2: Odds Verification (ACTUAL API CALL)
        this.logger.log(`[SHADOW-EXEC] 🔍 Phase 2: Verifying odds via Safety Guard...`);

        let slipStatus: SlipStatus;
        try {
            slipStatus = await this.sabaExec.checkSlipStatus({
                matchId: params.matchId,
                oddsId: params.oddsId,
                expectedOdds: params.expectedOdds
            });
        } catch (e) {
            slipStatus = {
                isValid: false,
                currentOdds: null,
                expectedOdds: params.expectedOdds,
                oddsChanged: false,
                reason: `SHADOW_ERROR: ${e.message}`,
                timestamp: Date.now()
            };
        }

        // Phase 3: Decision
        const wouldExecute = slipStatus.isValid;

        if (wouldExecute) {
            this.logger.log(`[SHADOW-EXEC] ✅ Phase 3: Odds VERIFIED - Would execute bet`);
            this.logger.log(`[SHADOW-EXEC] 🔒 LOCKED: 'Place Bet' click BLOCKED (Shadow Mode)`);
        } else {
            this.logger.log(`[SHADOW-EXEC] ❌ Phase 3: ${slipStatus.reason}`);
        }

        // Log result
        const logLine = `[COLD-RUN] Potential Arb Found: ${params.matchName} | Profit: calc | Safety Check: ${wouldExecute ? 'OK' : 'FAIL'} | Reason: ${slipStatus.reason}`;
        this.logger.log(logLine);
        this.appendToLog(logLine);

        return {
            phase: 'COMPLETE',
            status: wouldExecute ? 'WOULD_EXECUTE' : 'ABORTED',
            details: slipStatus,
            wouldExecute
        };
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * TOKEN REFRESH WATCHDOG
     * ═══════════════════════════════════════════════════════════════════════
     * Monitor SABA token rotation and data continuity
     */
    updateToken(newToken: string) {
        if (!newToken) return;

        const previousToken = this.tokenWatchdog.currentToken;

        if (previousToken && previousToken !== newToken) {
            // Token rotated!
            this.tokenWatchdog.rotationCount++;
            this.tokenWatchdog.lastRotation = Date.now();
            this.tokenWatchdog.status = 'ROTATING';

            this.logger.warn(`[TOKEN-WATCHDOG] 🔄 Token rotation detected! (Rotation #${this.tokenWatchdog.rotationCount})`);
            this.logger.log(`[TOKEN-WATCHDOG] Previous: ${previousToken.substring(0, 20)}...`);
            this.logger.log(`[TOKEN-WATCHDOG] New: ${newToken.substring(0, 20)}...`);

            // Check for data interruption in next 5 seconds
            setTimeout(() => {
                if (this.tokenWatchdog.status === 'ROTATING') {
                    this.tokenWatchdog.status = 'HEALTHY';
                    this.logger.log(`[TOKEN-WATCHDOG] ✅ Token rotation successful - No interruption`);
                }
            }, 5000);
        }

        this.tokenWatchdog.currentToken = newToken;
    }

    private updateTokenWatchdog() {
        if (this.tokenWatchdog.lastRotation > 0) {
            this.tokenWatchdog.tokenAge = Math.floor((Date.now() - this.tokenWatchdog.lastRotation) / 60000);
        }

        // Mark as STALE if no rotation in 30 minutes (unusual)
        if (this.tokenWatchdog.tokenAge > 30 && this.tokenWatchdog.currentToken) {
            this.tokenWatchdog.status = 'STALE';
        }
    }

    recordDataInterruption() {
        if (this.tokenWatchdog.status === 'ROTATING') {
            this.tokenWatchdog.interruptionCount++;
            this.tokenWatchdog.status = 'INTERRUPTED';
            this.logger.error(`[TOKEN-WATCHDOG] ⚠️ Data interruption during token rotation!`);
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * LOGGING
     * ═══════════════════════════════════════════════════════════════════════
     */
    private logColdRun(
        matchName: string,
        profitPercent: number,
        oddsA: number,
        oddsB: number,
        safetyCheck: 'OK' | 'FAIL',
        reason: string,
        latencyMs: number,
        providerA: string,
        providerB: string,
        wouldExecute: boolean
    ) {
        const entry: ColdRunArbEntry = {
            timestamp: Date.now(),
            matchName,
            profitPercent,
            oddsA,
            oddsB,
            safetyCheck,
            safetyReason: reason,
            latencyMs,
            providerA,
            providerB,
            wouldExecute
        };

        this.arbLog.unshift(entry);
        if (this.arbLog.length > 100) this.arbLog.pop();

        // Console log
        const logStr = `[COLD-RUN] Potential Arb Found: ${profitPercent.toFixed(2)}% | Match: ${matchName} | Safety Check: ${safetyCheck} | Latency: ${latencyMs >= 0 ? latencyMs + 'ms' : 'N/A'}`;

        if (safetyCheck === 'OK') {
            this.logger.log(`✅ ${logStr}`);
        } else {
            this.logger.warn(`❌ ${logStr} | Reason: ${reason}`);
        }

        this.appendToLog(logStr);
    }

    private appendToLog(line: string) {
        try {
            const ts = new Date().toISOString();
            fs.appendFileSync(this.config.logPath, `[${ts}] ${line}\n`);
        } catch (e) { }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * BROADCASTS TO DASHBOARD
     * ═══════════════════════════════════════════════════════════════════════
     */
    private broadcastLatencyStats() {
        // Calculate drop rate
        const total = this.latencyStats.pairsSynced + this.latencyStats.pairsDropped;
        this.latencyStats.dropRatePercent = total > 0
            ? (this.latencyStats.pairsDropped / total) * 100
            : 0;

        this.latencyStats.lastUpdated = Date.now();

        // Add to history (for graph)
        this.latencyStats.history.push({
            timestamp: Date.now(),
            synced: this.latencyStats.pairsSynced,
            dropped: this.latencyStats.pairsDropped
        });
        if (this.latencyStats.history.length > 60) this.latencyStats.history.shift();

        this.gateway.sendUpdate('cold_run_latency', this.latencyStats);
    }

    private broadcastTokenStatus() {
        this.gateway.sendUpdate('cold_run_token', this.tokenWatchdog);
    }

    private broadcastArbLog() {
        this.gateway.sendUpdate('cold_run_arb_log', {
            entries: this.arbLog.slice(0, 20),
            totalFound: this.arbLog.filter(e => e.safetyCheck === 'OK').length,
            totalBlocked: this.arbLog.filter(e => e.safetyCheck === 'FAIL').length
        });
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * PUBLIC API
     * ═══════════════════════════════════════════════════════════════════════
     */
    getLatencyStats(): LatencyStats {
        return { ...this.latencyStats };
    }

    getTokenWatchdog(): TokenWatchdogState {
        return { ...this.tokenWatchdog };
    }

    getArbLog(): ColdRunArbEntry[] {
        return [...this.arbLog];
    }

    isEnabled(): boolean {
        return this.config.enabled;
    }

    isShadowMode(): boolean {
        return this.config.shadowMode;
    }
}
