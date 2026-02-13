import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppGateway } from '../gateway.module';
import { NormalizationService } from '../normalization/normalization.service';
import { RedisService } from '../shared/redis.service';
import { CommandRouterService } from '../command/command-router.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface RawOdds {
    eventId?: string; // INJECTED BY WORKER
    provider: "A" | "B";
    bookmaker: string;
    league: string;
    market: "FT_HDP" | "FT_OU" | "HT_HDP" | "HT_OU";
    home: string;
    away: string;
    startTime?: number;
    odds: {
        selection: string;
        line: string;
        val: number;
    };
    selectionId?: string | number;
    receivedAt: number;
    matchId?: string;
}

export interface PairedMatch {
    pairId: string;
    eventId: string;
    market: string;
    marketLabel?: string;
    league: string;
    legA?: RawOdds;
    legB?: RawOdds;
    score: number;
    lastUpdate: number;
    status: "PAIRED" | "FORCE_DISP";
    profit?: string;
    signature: string;
}

interface EventBucket {
    eventId: string;
    oddsA: RawOdds[];
    oddsB: RawOdds[];
    lastUpdate: number;
}

@Injectable()
export class PairingService implements OnModuleInit {
    // 1. EVENT BUFFER (Global Registry)
    private eventBuffers = new Map<string, EventBucket>();

    // Duplicate Guard
    private activePairs = new Map<string, PairedMatch>();

    // Config
    private readonly MAX_ODDS_PER_EVENT = 50;
    private readonly EVENT_TTL = 300_000; // 5 mins inactive

    private bypassProfitUntil = 0;
    private hasChanges = false; // 🛡️ v7.5 Change Tracker

    constructor(
        private gateway: AppGateway,
        private normalization: NormalizationService,
        private redisService: RedisService,
        private commandRouter: CommandRouterService
    ) {
        // Register commands owned/observed by pairing service
        this.commandRouter.register('REFRESH_SCANNER', async () => {
            console.log('[PAIRING-CMD] 🔄 Received REFRESH_SCANNER - Broadcasting all pairs');
            this.broadcastAllPairs();
        });
        this.commandRouter.register('BYPASS_PROFIT', async () => {
            console.log('[PAIRING-CMD] 🔓 BYPASS_PROFIT active for 30s');
            this.bypassProfitUntil = Date.now() + 30000;
        });
    }

    private logToDisk(msg: string) {
        try {
            fs.appendFileSync(path.join(process.cwd(), 'forensic_debug.log'), `[${new Date().toISOString()}] ${msg}\n`);
        } catch (e) { }
    }

    public getStats() {
        let arbCount = 0;
        let maxProfit = 0;
        for (const [, pair] of this.activePairs) {
            const p = parseFloat(pair.profit || '0');
            if (p > 0) {
                arbCount++;
                if (p > maxProfit) maxProfit = p;
            }
        }
        return {
            totalBufferedEvents: this.eventBuffers.size,
            activePairs: this.activePairs.size,
            arbOpportunities: arbCount,
            maxProfit
        };
    }

    /**
     * 🧹 Clean ALL state for a specific account when toggled OFF (Ghost Prevention)
     */
    public cleanAccount(account: 'A' | 'B') {
        console.log(`[PAIRING-RESET] 🧹 Cleaning account ${account}...`);

        let eventsCleaned = 0;
        let pairsCleaned = 0;

        // 1. Clean event buffers - remove odds from this account
        for (const [eventId, bucket] of this.eventBuffers) {
            if (account === 'A') {
                bucket.oddsA = [];
            } else {
                bucket.oddsB = [];
            }

            // If bucket is now empty on both sides, delete it
            if (bucket.oddsA.length === 0 && bucket.oddsB.length === 0) {
                this.eventBuffers.delete(eventId);
                eventsCleaned++;
            }
        }

        // 2. Clean active pairs that have legs from this account
        for (const [pairId, pair] of this.activePairs) {
            if ((pair.legA && pair.legA.provider === account) ||
                (pair.legB && pair.legB.provider === account)) {
                this.activePairs.delete(pairId);
                pairsCleaned++;
            }
        }

        console.log(`[PAIRING-RESET] ✅ Account ${account} purged: events=${eventsCleaned}, pairs=${pairsCleaned}`);
    }

    onModuleInit() {
        // 🔍 STARTUP BANNER - Verify Singleton
        console.log(`\n============================================`);
        console.log(`🔧 [PAIRING-SERVICE-INIT] Instance created at ${new Date().toISOString()}`);
        console.log(`   eventBuffers Map ID: ${(this.eventBuffers as any).__id || 'new'}`);
        console.log(`   activePairs Map ID: ${(this.activePairs as any).__id || 'new'}`);
        // Tag the maps for tracking - 🚨 v3.3 FIX: Use HOUR-BASED ID instead of session-based
        const hourBasedId = Math.floor(Date.now() / 3600000); // Changes only every hour
        (this.eventBuffers as any).__id = hourBasedId;
        (this.activePairs as any).__id = hourBasedId;
        console.log(`   Tagged with Hour-Based IDs: ${(this.eventBuffers as any).__id}`);
        console.log(`============================================\n`);

        // 🚨 EMERGENCY v3.3: RESTORED PURGE (v7.4 Stabilization)
        setInterval(() => this.purgeBuffers(), 30_000);
        console.log(`[STABILIZATION] ✅ purgeBuffers RE-ENABLED (5 min TTL)`);

        // 🔍 SHADOW MODE: Periodic Status Report (every 15 seconds for faster feedback)
        setInterval(() => {
            const totalEvents = this.eventBuffers.size;
            const totalPairs = this.activePairs.size;

            // 🛰️ v3.2 Dynamic Execution Guard
            let eventsA = 0;
            let eventsB = 0;
            for (const bucket of this.eventBuffers.values()) {
                if (bucket.oddsA.length > 0) eventsA++;
                if (bucket.oddsB.length > 0) eventsB++;
            }

            const guardStatus = (eventsA > 0 && eventsB > 0) ? 'READY 🟢' : 'BLOCKED 🔴';

            let arbCount = 0;
            let maxProfit = 0;

            for (const [, pair] of this.activePairs) {
                const p = parseFloat(pair.profit || '0');
                if (p > 0) {
                    arbCount++;
                    if (p > maxProfit) maxProfit = p;
                }
            }

            console.log(`\n[SHADOW-REPORT] ⏱ ${new Date().toLocaleTimeString()} MapID=${(this.eventBuffers as any).__id}`);
            // v3.5.3: Ensure UI is in sync (periodic)
            this.broadcastAllPairs();
        }, 15_000); // Status log every 15s

        // 🔥 v7.5 Throttled Batching: Only broadcast if substantive changes occurred
        setInterval(() => {
            if (this.hasChanges) {
                this.broadcastAllPairs();
                this.hasChanges = false;
            }
        }, 1000);
    }

    private broadcastAllPairs() {
        if (!this.gateway.server) return;

        const allPairs = Array.from(this.activePairs.values());
        if (allPairs.length > 0) {
            // console.log(`[PAIRING] Batched broadcast of ${allPairs.length} active pairs`);
            this.gateway.sendUpdate('scanner:update_batch', allPairs);
        }

        // Also broadcast single-side events from buffers that haven't paired yet
        const emergencyPairs: PairedMatch[] = [];
        for (const bucket of this.eventBuffers.values()) {
            const odds = bucket.oddsA[0] || bucket.oddsB[0];
            if (!odds) continue;

            emergencyPairs.push({
                pairId: `force_${bucket.eventId}`,
                eventId: bucket.eventId,
                market: odds.market || 'MARKET_ANY',
                marketLabel: `${odds.market} ${odds.odds?.line || ''}`,
                league: odds.league || 'LEAGUE_ANY',
                legA: bucket.oddsA[0] || null,
                legB: bucket.oddsB[0] || null,
                score: 1.0,
                lastUpdate: bucket.lastUpdate,
                status: "FORCE_DISP",
                profit: "0.00",
                signature: `f_sig_${bucket.eventId}`
            });
        }

        if (emergencyPairs.length > 0) {
            this.gateway.sendUpdate('scanner:update_batch', emergencyPairs.slice(0, 100)); // Limit batch size
        }
    }

    public processIncomingOdds(odds: RawOdds) {
        // 🔍 ENTRY TRACE
        // console.log(`[PAIRING-ENTRY] provider=${odds.provider} event=${odds.eventId?.substring(0, 8) || 'NONE'} market=${odds.market}`);

        // 2. SIGNATURE GATE (ANTI CACAT)
        if (!this.checkSignature(odds)) {
            // Log handled in checkSignature
            return;
        }

        this.addToBuffer(odds);

        // [MARKET-BUS] MANDATORY LOG
        // console.log(`[MARKET-BUS] 📥 RECEIVED provider=${odds.bookmaker} event=${odds.eventId?.substring(0, 8)} market=${odds.market}`);

        this.scanEvent(odds.eventId!);
    }

    private checkSignature(odds: RawOdds): boolean {
        // Must have EventID
        if (!odds.eventId) {
            // Worker should have caught this, but double check
            return false;
        }

        // Must have Market
        if (!odds.market) {
            console.log(`[PAIR-BLOCKED] reason=missing_market ${odds.provider}`);
            return false;
        }

        // Must have Side (Selection)
        if (!odds.odds.selection) {
            console.log(`[PAIR-BLOCKED] reason=missing_side ${odds.provider} ${odds.market}`);
            return false;
        }

        // Must have Line (Number parseable)
        // Worker ensures it is a string representation of a number, but let's verify
        if (odds.odds.line === undefined || odds.odds.line === null || odds.odds.line === 'undefined') {
            console.log(`[PAIR-BLOCKED] reason=missing_line ${odds.provider} ${odds.market}`);
            return false;
        }

        return true;
    }

    private addToBuffer(odds: RawOdds) {
        if (!this.eventBuffers.has(odds.eventId!)) {
            this.eventBuffers.set(odds.eventId!, {
                eventId: odds.eventId!,
                oddsA: [],
                oddsB: [],
                lastUpdate: Date.now()
            });
        }

        // 1. [MARKET-REGISTER] - Confirms it reached the Pairing Buffer
        const regMsg = `[MARKET-REGISTER] event=${odds.eventId!.substring(0, 8)} provider=${odds.provider} market=${odds.market} line=${odds.odds.line} side=${odds.odds.selection}`;
        console.log(regMsg);
        this.logToDisk(regMsg);

        const bucket = this.eventBuffers.get(odds.eventId!)!;
        bucket.lastUpdate = Date.now();

        const list = odds.provider === 'A' ? bucket.oddsA : bucket.oddsB;

        // Dedup policy: Remove older odds for EXACT same market+line+side
        // To keep the buffer fresh
        const existingIndex = list.findIndex(o =>
            o.market === odds.market &&
            o.odds.line === odds.odds.line &&
            o.odds.selection === odds.odds.selection
        );

        if (existingIndex >= 0) {
            list[existingIndex] = odds; // Replace
        } else {
            list.push(odds);
            // Size Cap
            if (list.length > this.MAX_ODDS_PER_EVENT) list.shift();
        }

        // 🔍 FORCED STATE SNAPSHOT
        const stateBufferMsg = `[STATE-BUFFER] event=${odds.eventId!.substring(0, 8)} provider=${odds.provider} oddsA=${bucket.oddsA.length} oddsB=${bucket.oddsB.length} totalEvents=${this.eventBuffers.size}`;
        console.log(stateBufferMsg);

        // [LIVE-SCANNER] 👁 MATCH_ACCEPTED - Emit to UI for single-side visibility!
        // We create a virtual pair with only one leg to satisfy the scanner
        const virtualPair: PairedMatch = {
            pairId: `virtual_${odds.eventId}_${odds.provider}`,
            eventId: odds.eventId!,
            market: odds.market,
            marketLabel: `${odds.market} ${odds.odds.line}`,
            league: odds.league,
            legA: odds.provider === 'A' ? odds : undefined,
            legB: odds.provider === 'B' ? odds : undefined,
            score: 0.5,
            lastUpdate: Date.now(),
            status: "PAIRED",
            profit: "0.00",
            signature: `single_${odds.provider}`
        };

        this.hasChanges = true; // 🛡️ v7.5 Signal Change
        this.gateway.sendUpdate("scanner:update", virtualPair);
    }

    private scanEvent(eventId: string) {
        const bucket = this.eventBuffers.get(eventId);
        if (!bucket) return;

        // 4. EVENT-SCOPED SCAN
        // console.log(`[MARKET-PAIRING] Scanning Event ${eventId.substring(0,8)} | A=${bucket.oddsA.length} B=${bucket.oddsB.length}`);

        for (const oddA of bucket.oddsA) {
            for (const oddB of bucket.oddsB) {
                // FORENSIC: Log every attempt? Too noisy. Log failures inside isComplementary.
                if (this.isComplementary(oddA, oddB)) {
                    this.createPair(oddA, oddB, eventId);
                }
            }
        }
    }

    // 3. COMPLEMENTARY RULE ENGINE
    private isComplementary(a: RawOdds, b: RawOdds): boolean {
        // Market Mismatch
        if (a.market !== b.market) {
            // Too noisy to log every type mismatch in N*M loop
            return false;
        }

        const lineA = parseFloat(a.odds.line);
        const lineB = parseFloat(b.odds.line);

        // HDP Rules
        if (a.market.includes('HDP')) {
            // Side: Home vs Away
            if (!this.isOppositeSide(a.odds.selection, b.odds.selection)) {
                // console.log(`[MARKET-REJECT] SIDE_MISMATCH (HDP): A=${a.odds.selection} B=${b.odds.selection}`);
                return false;
            }

            // Line: Sum ~ 0 (e.g. -0.50 + 0.50 = 0)
            if (Math.abs(lineA + lineB) > 0.05) {
                // console.log(`[MARKET-REJECT] LINE_MISMATCH (HDP): A=${lineA} B=${lineB}`);
                return false;
            }
            const pairMatchHdpMsg = `[PAIR-MATCH] HDP OK`;
            console.log(pairMatchHdpMsg);
            this.logToDisk(pairMatchHdpMsg);
            return true;
        }

        // OU Rules
        if (a.market.includes('OU')) {
            // Side: Over vs Under
            if (!this.isOppositeOU(a.odds.selection, b.odds.selection)) {
                // console.log(`[MARKET-REJECT] SIDE_MISMATCH (OU): A=${a.odds.selection} B=${b.odds.selection}`);
                return false;
            }

            // Line: Equal (e.g. 2.50 vs 2.50)
            if (Math.abs(lineA - lineB) > 0.05) {
                // console.log(`[MARKET-REJECT] LINE_MISMATCH (OU): A=${lineA} B=${lineB}`);
                return false;
            }

            const pairMatchOuMsg = `[PAIR-MATCH] OU OK (Symmetry Verified)`;
            console.log(pairMatchOuMsg);
            this.logToDisk(pairMatchOuMsg);
            return true;
        }

        return false;
    }

    private createPair(a: RawOdds, b: RawOdds, eventId: string) {
        // 5. OUTPUT LAYER & 6. DUPLICATE GUARD

        // Build Signature: eventId|market|line|sideA|sideB
        // Use normalized sides for consistent signature ordering? No, stick to Provider A vs B
        const sigLine = Math.abs(parseFloat(a.odds.line)).toFixed(2);
        const pairSignature = `${eventId}|${a.market}|${sigLine}|${a.odds.selection}|${b.odds.selection}`;

        // Check Duplicate
        const pairId = crypto.createHash('md5').update(pairSignature).digest('hex');

        if (this.activePairs.has(pairId)) {
            // Still active, just update timestamp
            this.activePairs.get(pairId)!.lastUpdate = Date.now();
            // console.log(`[PAIR-DUPLICATE-BLOCK] ${eventId} ${a.market} ${sigLine}`);
            return;
        }

        // 🔥 HARD GUARD: Ensure decimal odds
        const decA = Number(a.odds.val);
        const decB = Number(b.odds.val);

        if (decA < 1.01 || decB < 1.01) {
            console.error(`[ARBITRAGE-BLOCKED] Non-decimal odds detected! decA=${decA} decB=${decB}`);
            return;
        }

        // 🛡️ v7.4 LIQUIDITY & BALANCE GUARD
        // Drop match if odds are extremely high (likely low liquidity) or zero
        if (decA > 100 || decB > 100) {
            console.log(`[LIQUIDITY-GUARD] 🛡️ Rejected high odds pair (Potential low liquidity)`);
            return;
        }

        // 🔍 AUDIT LOG - Arbitrage calculation with decimal odds
        const implied = (1 / decA) + (1 / decB);
        let profitVal = (1 - implied) * 100;

        // 🛡️ v3.5.6 PROFIT CAP & ANOMALY FILTER
        if (profitVal > 20) {
            console.log(`[ARB-CAP] 🛡️ Profit ${profitVal.toFixed(2)}% capped at 20.00% (Anomali Check)`);
            profitVal = 20.00;
        }
        if (profitVal < -20) profitVal = -20.00; // Floor for display

        // 🛡️ v3.5.3 BYPASS PROFIT CHECK
        if (Date.now() < this.bypassProfitUntil) {
            if (profitVal < 10) {
                console.log(`[ARB-BYPASS] 🔓 Forcing profit from ${profitVal.toFixed(2)}% to 10.00%`);
                profitVal = 10.00; // Force visibility
            }
        }

        console.log(`[ARBITRAGE-CHECK] oddsA=${decA.toFixed(4)} oddsB=${decB.toFixed(4)} implied=${implied.toFixed(4)} profit=${profitVal.toFixed(2)}%`);

        const marketLabel = `${a.market.replace('_', ' ')} ${sigLine}`;

        const pair: PairedMatch = {
            pairId,
            eventId,
            market: a.market,
            marketLabel,
            league: a.league,
            legA: a,
            legB: b,
            score: 1.0,
            lastUpdate: Date.now(),
            status: "PAIRED",
            profit: profitVal.toFixed(2),
            signature: pairSignature
        };

        this.activePairs.set(pairId, pair);
        this.hasChanges = true; // 🛡️ v7.5 Signal Change

        // [MARKET-PAIR] and [ARB-CHECK]
        const pairMsg = `[MARKET-PAIR] OK id=${pairId.substring(0, 8)} Event:${eventId.substring(0, 6)} ${marketLabel}`;
        console.log(pairMsg);
        this.logToDisk(pairMsg);

        const arbMsg = `[ARB-CHECK] A=${decA.toFixed(2)} B=${decB.toFixed(2)} Implied=${implied.toFixed(4)}`;
        console.log(arbMsg);
        this.logToDisk(arbMsg);

        if (profitVal > 0) {
            const candMsg = `[ARB-CANDIDATE] 💰 PROFIT=${profitVal.toFixed(2)}% | ${a.odds.selection}@${decA} vs ${b.odds.selection}@${decB}`;
            console.log(candMsg);
            this.logToDisk(candMsg);
        } else {
            const rejMsg = `[ARB-REJECT] Profit=${profitVal.toFixed(2)}% (Target > 0)`;
            console.log(rejMsg);
            this.logToDisk(rejMsg);
        }

        console.log(`[STATE-PAIRS] totalActivePairs=${this.activePairs.size} totalEvents=${this.eventBuffers.size}`);

        // ============================================
        // 🔍 SHADOW MODE MONITORING
        // ============================================
        const profitNum = parseFloat(pair.profit || '0');

        if (profitNum > 0) {
            console.log(`\n========================================`);
            console.log(`🎯 [ARBITRAGE-DETECTED] PROFIT: ${pair.profit}%`);
            console.log(`   Event: ${eventId.substring(0, 8)}`);
            console.log(`   Market: ${a.market} ${sigLine}`);
            console.log(`   LegA: ${a.odds.selection}@${decA.toFixed(3)} (${a.bookmaker})`);
            console.log(`   LegB: ${b.odds.selection}@${decB.toFixed(3)} (${b.bookmaker})`);
            console.log(`   Formula: 1/${decA.toFixed(3)} + 1/${decB.toFixed(3)} = ${((1 / decA) + (1 / decB)).toFixed(4)}`);
            console.log(`   [EXECUTION-GUARD] STATUS: ENABLED (Live Mode)`);
            console.log(`========================================\n`);
        } else {
            // Log non-arb pairs at debug level
            console.log(`[LIVE-WATCH] ${eventId.substring(0, 6)} ${a.market} profit=${pair.profit}% (no arb)`);
        }
        // ============================================

        this.emitScanner(pair);
    }

    private emitScanner(pair: PairedMatch) {
        console.log(`[SCANNER-EMIT] pairId=${pair.pairId.substring(0, 8)} event=${pair.eventId.substring(0, 6)} ${pair.market} profit=${pair.profit}%`);

        // 🕵️ TRACE_AUDIT INJECTION
        if (pair.legB) {
            console.log('[TRACE_AUDIT][LEVEL:BACKEND] Processed & Pushing:', {
                match_id: pair.eventId,
                odds_value: pair.legB.odds.val,
                calculation_time_ms: Date.now() - pair.legB.receivedAt
            });
        }

        // [LIVE-SCANNER] MANDATORY LOG
        console.log(`[LIVE-SCANNER] 👁 MATCH_ACCEPTED id=${pair.eventId.substring(0, 8)} pair=${pair.pairId.substring(0, 8)} profit=${pair.profit}%`);

        this.gateway.sendUpdate("scanner:update_batch", [pair]);
    }

    private purgeBuffers() {
        const now = Date.now();
        let purgedEvents = 0;
        let purgedPairs = 0;

        for (const [id, bucket] of this.eventBuffers) {
            if (now - bucket.lastUpdate > this.EVENT_TTL) {
                this.eventBuffers.delete(id);
                purgedEvents++;
            }
        }
        // Also purge active pairs
        for (const [id, pair] of this.activePairs) {
            if (now - pair.lastUpdate > this.EVENT_TTL) {
                this.activePairs.delete(id);
                purgedPairs++;
            }
        }

        // Log only if something was purged
        if (purgedEvents > 0 || purgedPairs > 0) {
            console.log(`[PURGE] Removed ${purgedEvents} events, ${purgedPairs} pairs. Remaining: events=${this.eventBuffers.size} pairs=${this.activePairs.size}`);
        }
    }

    // Utils
    private isOppositeSide(s1: string, s2: string) {
        const n1 = this.normSel(s1);
        const n2 = this.normSel(s2);
        return (n1 === 'home' && n2 === 'away') || (n1 === 'away' && n2 === 'home');
    }
    private isOppositeOU(s1: string, s2: string) {
        const n1 = this.normSel(s1);
        const n2 = this.normSel(s2);
        return (n1 === 'over' && n2 === 'under') || (n1 === 'under' && n2 === 'over');
    }
    private normSel(s: string) {
        s = s.toLowerCase();
        if (s.includes('home')) return 'home';
        if (s.includes('away')) return 'away';
        if (s.includes('over')) return 'over';
        if (s.includes('under')) return 'under';
        return '';
    }
}
