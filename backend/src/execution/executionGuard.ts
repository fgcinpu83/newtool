import { ArbitrageOpportunity } from "../arbitrage/schemas";

export function validateExecution(opp: ArbitrageOpportunity): boolean {
    // SHADOW MODE ENFORCEMENT
    // Hard Safety Rule: NO real bet execution allowed.
    console.warn(`[EXECUTION-BLOCKED] Shadow Mode Active. Blocking execution for opp: ${opp.GlobalEventID} Profit: ${opp.ExpectedProfitPercent}%`);
    return false;

    // Original logic (disabled for shadow mode)
    // if (opp.ExpectedProfitPercent <= 0) return false;
    // if (opp.SideA.Stake <= 0 || opp.SideB.Stake <= 0) return false;
    // return true;
}
