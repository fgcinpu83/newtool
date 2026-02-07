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

export async function executeArbitrage(
    opp: ArbitrageOpportunity,
    globalGuard: GlobalExecutionGuard,
): Promise<ExecutionResult | null> {
    // Guard THROWS if blocked — catch and abort cleanly
    try {
        validateExecution(opp, globalGuard);
    } catch (err) {
        if (err instanceof ExecutionBlockedError) {
            console.warn(`[ENGINE] BLOCKED by guard: ${err.message} (check: ${err.check})`);
        } else {
            console.error(`[ENGINE] Unexpected guard error:`, err);
        }
        return null;
    }

    // Enforce 60s global cooldown
    await enforceCooldown(60000);

    const plan = buildExecutionPlan(opp);
    const { first, second } = plan;

    const exec1 = first.Provider === 'A' ? betOnA : betOnB;
    const exec2 = second.Provider === 'A' ? betOnA : betOnB;

    // Execute First Bet
    const firstResult = await exec1(first);

    if (firstResult.Status !== 'ACCEPTED') {
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

    // Execute Second Bet (Hedge)
    const secondResult = await exec2(second);

    const finalStatus = secondResult.Status === 'ACCEPTED' ? 'SUCCESS' : 'PARTIAL';

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
