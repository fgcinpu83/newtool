import { ArbitrageOpportunity } from "../arbitrage/schemas";
import { GlobalExecutionGuard, ExecutionContext } from "../guards/global-execution.guard";

// Provider readiness interface for execution validation
export interface ProviderReadiness {
    accountAReady: boolean;
    accountBReady: boolean;
    systemReady: boolean;
}

export async function validateExecution(opp: ArbitrageOpportunity, readiness?: ProviderReadiness, globalGuard?: GlobalExecutionGuard): Promise<boolean> {
    // SHADOW MODE ENFORCEMENT - Keep blocking real execution during audit
    console.warn(`[EXECUTION-BLOCKED] Shadow Mode Active. Blocking execution for opp: ${opp.GlobalEventID} Profit: ${opp.ExpectedProfitPercent}%`);
    return false;

    // Future implementation: Use GlobalExecutionGuard for comprehensive validation
    if (globalGuard) {
        // Create execution contexts for both sides
        const contextA: ExecutionContext = {
            account: 'A',
            providerId: opp.SideA.Provider || 'A1', // Default to A1 if not specified
            stake: opp.SideA.Stake,
            odds: opp.SideA.Odds
        };

        const contextB: ExecutionContext = {
            account: 'B',
            providerId: opp.SideB.Provider || 'B1', // Default to B1 if not specified
            stake: opp.SideB.Stake,
            odds: opp.SideB.Odds
        };

        // Check both sides
        const resultA = await globalGuard.assertExecutable(contextA);
        const resultB = await globalGuard.assertExecutable(contextB);

        if (!resultA.allowed || !resultB.allowed) {
            console.warn(`[EXECUTION-GUARD] 🚫 Blocked: A=${resultA.reason}, B=${resultB.reason}`);
            return false;
        }

        console.log(`[EXECUTION-GUARD] ✅ Global guard passed for both sides`);
        return true;
    }

    // Fallback to basic readiness check
    if (readiness && !readiness.systemReady) {
        console.warn(`[EXECUTION-GUARD] 🛡️ Blocked: System not ready. A=${readiness.accountAReady}, B=${readiness.accountBReady}`);
        return false;
    }

    // Original logic (disabled for shadow mode)
    // if (opp.ExpectedProfitPercent <= 0) return false;
    // if (opp.SideA.Stake <= 0 || opp.SideB.Stake <= 0) return false;
    // return true;
}
