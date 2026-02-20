/**
 * Execution Engine v2.0 — CONSTITUTION §III.3 COMPLIANT
 *
 * globalGuard is REQUIRED — no optional bypass.
 * validateExecution() THROWS on failure; engine catches and returns null.
 */

import { buildExecutionPlan } from './executionPlanner';
import { validateExecution } from './executionGuard';
import { enforceCooldown } from './cooldownController';
import { betOnA } from './betExecutorA';
import { betOnB } from './betExecutorB';
import { ArbitrageOpportunity } from '../arbitrage/schemas';
import { ExecutionResult } from './schemas';
import { GlobalExecutionGuard, ExecutionBlockedError } from '../guards/global-execution.guard';
import { executeHedge } from './hedge.service';
// execution.lock removed (Master Context v4.0): double-run protection handled by guard/audit layer
import { canPlace, addExposure, reduceExposure } from './exposure.service';
import { SqliteService } from '../shared/sqlite.service';

const sqlite = new SqliteService();

// Watchdog removed per Master Context v4.0 — no background auto-recovery or forced lock release

const EXECUTION_TIMEOUT_MS = parseInt(String(process.env.EXECUTION_TIMEOUT_MS || '30000'));

export async function executeArbitrage(
    opp: ArbitrageOpportunity,
    globalGuard: GlobalExecutionGuard,
): Promise<ExecutionResult | null> {
    let hedgeTriggered = false;
    const matchId = opp.GlobalEventID || `M_${Date.now()}`;

    // NOTE: In-process execution lock removed (no global executionLock flags).
    // Double-run protection is enforced via guard/SQLite audit semantics instead.

    let auditRowId: number | null = null;
    // Guard THROWS if blocked — catch and abort cleanly
    try {
        // Persist initial audit row — required before execution can proceed
        try {
            const res = sqlite.saveExecutionAudit({ timestamp: Date.now(), matchId, providerA: opp.SideA.Provider, providerB: opp.SideB.Provider, stakeA: opp.SideA.Stake, stakeB: opp.SideB.Stake, legA_status: 'PENDING', legB_status: 'PENDING', hedge_triggered: false, final_status: 'PENDING' });
            auditRowId = (res && (res as any).lastInsertRowid) || null;
        } catch (e) {
            console.error('[ENGINE] Audit row write failed — aborting execution:', e && (e as any).message ? (e as any).message : String(e));
            throw e;
        }

        // Validate execution guard
        validateExecution(opp, globalGuard);
    } catch (err) {
        if (err instanceof ExecutionBlockedError) {
            console.warn(`[ENGINE] BLOCKED by guard: ${err.message} (check: ${err.check})`);
            if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { final_status: 'ABORTED', error_message: err.message });
        } else {
            console.error(`[ENGINE] Unexpected guard error:`, err);
            if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { final_status: 'FAILED', error_message: (err as Error).message });
        }
        // execution lock removed — nothing to release
        return null;
    }

    // Enforce 60s global cooldown
    await enforceCooldown(60000);

    const plan = buildExecutionPlan(opp);
    const { first, second } = plan;

    const exec1 = first.Provider === 'A' ? betOnA : betOnB;
    const exec2 = second.Provider === 'A' ? betOnA : betOnB;

    // Exposure checks (production only)
    if (!canPlace('A', matchId, opp.SideA.Stake)) {
        const msg = '[ENGINE] Exposure limit exceeded for A';
        console.warn(msg);
        if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { final_status: 'ABORTED', error_message: msg });
        return null;
    }
    if (!canPlace('B', matchId, opp.SideB.Stake)) {
        const msg = '[ENGINE] Exposure limit exceeded for B';
        console.warn(msg);
        if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { final_status: 'ABORTED', error_message: msg });
        return null;
    }

    // Helper to run executor with timeout protection
    const runWithTimeout = async (fn: any, args: any) => {
        return await Promise.race([
            fn(args),
            new Promise(resolve => setTimeout(() => resolve({ Status: 'FAILED', __reason: 'TIMEOUT' }), EXECUTION_TIMEOUT_MS))
        ]);
    };

    // Execute First Bet
    const firstResult = await runWithTimeout(exec1, first) as any;

    if (firstResult.Status !== 'ACCEPTED') {
        if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { legA_status: firstResult.Status || 'FAILED', final_status: 'ABORTED', error_message: firstResult.__reason || null });
        // execution lock removed — nothing to release
        return {
            GlobalEventID: opp.GlobalEventID,
            MarketType: opp.MarketType,
            Line: opp.Line,
            FirstBet: firstResult,
            SecondBet: { ...second, Status: 'SKIPPED' },
            FinalStatus: 'ABORTED',
            Timestamp: Date.now(),
        };
    }

    // Reserve exposure for A (will be reduced/cleared after settlement or on failure)
    try { addExposure('A', matchId, opp.SideA.Stake); } catch (e) {}
    if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { legA_status: 'ACCEPTED' });

    // Execute Second Bet (Hedge)
    const secondResult = await runWithTimeout(exec2, second) as any;

    // Atomic execution guard: if first accepted but second failed, trigger hedge protocol
    if (firstResult.Status === 'ACCEPTED' && secondResult.Status !== 'ACCEPTED') {
        try {
            hedgeTriggered = true;
            await executeHedge({ opportunity: opp, firstResult, second }, auditRowId);
        } catch (e) {
            console.error('[ENGINE] Hedge protocol failed:', e);
        }
        // Reduce exposure for A since hedge attempted/failed
        try { reduceExposure('A', matchId, opp.SideA.Stake); } catch (e) {}
        if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { legB_status: secondResult.Status || 'FAILED', hedge_triggered: true, final_status: 'HEDGED', error_message: secondResult.__reason || null });
        // execution lock removed — nothing to release
        return {
            GlobalEventID: opp.GlobalEventID,
            MarketType: opp.MarketType,
            Line: opp.Line,
            FirstBet: firstResult,
            SecondBet: secondResult,
            FinalStatus: 'HEDGED',
            Timestamp: Date.now(),
        };
    }

    const finalStatus = secondResult.Status === 'ACCEPTED' ? 'SUCCESS' : 'PARTIAL';

    // Update audit and exposure for successful flow
    try {
        if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { legB_status: secondResult.Status || 'UNKNOWN', hedge_triggered: hedgeTriggered, final_status: finalStatus });
        // On full success reserve/reduce as settlement will clear later — reduce now to keep exposure conservative
        if (finalStatus === 'SUCCESS') {
            try { reduceExposure('A', matchId, opp.SideA.Stake); } catch (e) {}
            try { reduceExposure('B', matchId, opp.SideB.Stake); } catch (e) {}
        }
    } catch (e) {
        console.warn('[ENGINE] Failed to update audit after execution:', e && (e as any).message ? (e as any).message : String(e));
    }

        // execution lock removed — nothing to release

    return {
        GlobalEventID: opp.GlobalEventID,
        MarketType: opp.MarketType,
        Line: opp.Line,
        FirstBet: firstResult,
        SecondBet: secondResult,
        FinalStatus: finalStatus,
        Timestamp: Date.now(),
    };
}
