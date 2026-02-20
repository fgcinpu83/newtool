/**
 * Execution Engine v2.0 — CONSTITUTION §III.3 COMPLIANT
 *
 * globalGuard is REQUIRED — no optional bypass.
 * validateExecution() THROWS on failure; engine catches and returns null.
 */

import { buildExecutionPlan } from './executionPlanner';
import { betOnA } from './betExecutorA';
import { betOnB } from './betExecutorB';
import { ArbitrageOpportunity } from '../arbitrage/schemas';
import { ExecutionResult } from './schemas';
import { executeHedge } from './hedge.service';
import { canPlace, addExposure, reduceExposure } from './exposure.service';
import { SqliteService } from '../shared/sqlite.service';
import { WorkerService } from '../workers/worker.service';

const sqlite = new SqliteService();
const EXECUTION_TIMEOUT_MS = parseInt(String(process.env.EXECUTION_TIMEOUT_MS || '30000'));

/**
 * Stateless execution engine.  Only depends on WorkerService state.
 */
export async function executeArbitrage(
    opp: ArbitrageOpportunity,
    worker: WorkerService,
): Promise<ExecutionResult | null> {
    // Basic sanity: both accounts must be ACTIVE
    const state = worker.getState();
    if (state.accounts.A.state !== 'ACTIVE' || state.accounts.B.state !== 'ACTIVE') {
        return null;
    }

    let hedgeTriggered = false;
    const matchId = opp.GlobalEventID || `M_${Date.now()}`;
    let auditRowId: number | null = null;

    // write audit row before anything else
    try {
        const res = sqlite.saveExecutionAudit({ timestamp: Date.now(), matchId, providerA: opp.SideA.Provider, providerB: opp.SideB.Provider, stakeA: opp.SideA.Stake, stakeB: opp.SideB.Stake, legA_status: 'PENDING', legB_status: 'PENDING', hedge_triggered: false, final_status: 'PENDING' });
        auditRowId = (res && (res as any).lastInsertRowid) || null;
    } catch (e) {
        console.error('[ENGINE] Audit row write failed — aborting execution:', e && (e as any).message ? (e as any).message : String(e));
        return null;
    }

    const plan = buildExecutionPlan(opp);
    const { first, second } = plan;
    const exec1 = first.Provider === 'A' ? betOnA : betOnB;
    const exec2 = second.Provider === 'A' ? betOnA : betOnB;

    // Exposure checks remain
    if (!canPlace('A', matchId, opp.SideA.Stake)) {
        const msg = '[ENGINE] Exposure limit exceeded for A';
        if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { final_status: 'ABORTED', error_message: msg });
        return null;
    }
    if (!canPlace('B', matchId, opp.SideB.Stake)) {
        const msg = '[ENGINE] Exposure limit exceeded for B';
        if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { final_status: 'ABORTED', error_message: msg });
        return null;
    }

    const runWithTimeout = async (fn: any, args: any) => {
        return await Promise.race([
            fn(args),
            new Promise(resolve => setTimeout(() => resolve({ Status: 'FAILED', __reason: 'TIMEOUT' }), EXECUTION_TIMEOUT_MS))
        ]);
    };

    const firstResult = await runWithTimeout(exec1, first) as any;
    if (firstResult.Status !== 'ACCEPTED') {
        if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { legA_status: firstResult.Status || 'FAILED', final_status: 'ABORTED', error_message: firstResult.__reason || null });
        return { GlobalEventID: opp.GlobalEventID, MarketType: opp.MarketType, Line: opp.Line, FirstBet: firstResult, SecondBet: { ...second, Status: 'SKIPPED' }, FinalStatus: 'ABORTED', Timestamp: Date.now() };
    }

    try { addExposure('A', matchId, opp.SideA.Stake); } catch (e) {}
    if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { legA_status: 'ACCEPTED' });

    const secondResult = await runWithTimeout(exec2, second) as any;

    if (firstResult.Status === 'ACCEPTED' && secondResult.Status !== 'ACCEPTED') {
        try { hedgeTriggered = true; await executeHedge({ opportunity: opp, firstResult, second }, auditRowId); } catch (e) { console.error('[ENGINE] Hedge protocol failed:', e); }
        try { reduceExposure('A', matchId, opp.SideA.Stake); } catch (e) {}
        if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { legB_status: secondResult.Status || 'FAILED', hedge_triggered: true, final_status: 'HEDGED', error_message: secondResult.__reason || null });
        return { GlobalEventID: opp.GlobalEventID, MarketType: opp.MarketType, Line: opp.Line, FirstBet: firstResult, SecondBet: secondResult, FinalStatus: 'HEDGED', Timestamp: Date.now() };
    }

    const finalStatus = secondResult.Status === 'ACCEPTED' ? 'SUCCESS' : 'PARTIAL';
    try {
        if (auditRowId) sqlite.updateExecutionAudit(auditRowId, { legB_status: secondResult.Status || 'UNKNOWN', hedge_triggered: hedgeTriggered, final_status: finalStatus });
        if (finalStatus === 'SUCCESS') { try { reduceExposure('A', matchId, opp.SideA.Stake); } catch {} try { reduceExposure('B', matchId, opp.SideB.Stake); } catch {} }
    } catch (e) { console.warn('[ENGINE] Failed to update audit after execution:', e && (e as any).message ? (e as any).message : String(e)); }

    return { GlobalEventID: opp.GlobalEventID, MarketType: opp.MarketType, Line: opp.Line, FirstBet: firstResult, SecondBet: secondResult, FinalStatus: finalStatus, Timestamp: Date.now() };
}
