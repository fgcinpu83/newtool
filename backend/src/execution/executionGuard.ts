/**
 * Execution Guard Wrapper v2.0 — CONSTITUTION §III.3 COMPLIANT
 *
 * Thin bridge between the execution engine and GlobalExecutionGuard.
 * globalGuard is REQUIRED — no fallback, no bypass.
 * Calls assertExecutable() for BOTH sides.  If either THROWS → propagate.
 */

import { ArbitrageOpportunity } from '../arbitrage/schemas';
import { GlobalExecutionGuard, ExecutionContext } from '../guards/global-execution.guard';

/**
 * Validates execution for BOTH sides of an arbitrage opportunity.
 * THROWS ExecutionBlockedError if either side fails the guard.
 */
export function validateExecution(
    opp: ArbitrageOpportunity,
    globalGuard: GlobalExecutionGuard,
): void {
    // Side A
    const contextA: ExecutionContext = {
        account: 'A',
        providerId: opp.SideA.Provider || 'A1',
    };
    globalGuard.assertExecutable(contextA);

    // Side B
    const contextB: ExecutionContext = {
        account: 'B',
        providerId: opp.SideB.Provider || 'B1',
    };
    globalGuard.assertExecutable(contextB);
}
