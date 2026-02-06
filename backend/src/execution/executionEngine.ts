import { buildExecutionPlan } from "./executionPlanner";
import { validateExecution } from "./executionGuard";
import { enforceCooldown } from "./cooldownController";
import { betOnA } from "./betExecutorA";
import { betOnB } from "./betExecutorB";
import { ArbitrageOpportunity } from "../arbitrage/schemas";
import { ExecutionResult } from "./schemas";

export async function executeArbitrage(opp: ArbitrageOpportunity): Promise<ExecutionResult | null> {
    if (!validateExecution(opp)) return null;

    // Enforce 60s global cooldown
    await enforceCooldown(60000);

    const plan = buildExecutionPlan(opp);
    const { first, second } = plan;

    const exec1 = first.Provider === "A" ? betOnA : betOnB;
    const exec2 = second.Provider === "A" ? betOnA : betOnB;

    // Execute First Bet
    const firstResult = await exec1(first);

    if (firstResult.Status !== "ACCEPTED") {
        return {
            GlobalEventID: opp.GlobalEventID,
            MarketType: opp.MarketType,
            Line: opp.Line,
            FirstBet: firstResult,
            SecondBet: { ...second, Status: "SKIPPED" }, // Skip second
            FinalStatus: "ABORTED",
            Timestamp: Date.now()
        };
    }

    // Execute Second Bet (Hedge)
    const secondResult = await exec2(second);

    const finalStatus = secondResult.Status === "ACCEPTED" ? "SUCCESS" : "PARTIAL";

    return {
        GlobalEventID: opp.GlobalEventID,
        MarketType: opp.MarketType,
        Line: opp.Line,
        FirstBet: firstResult,
        SecondBet: secondResult,
        FinalStatus: finalStatus,
        Timestamp: Date.now()
    };
}
