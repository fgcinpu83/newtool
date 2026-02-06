import { ArbitrageOpportunity } from "../arbitrage/schemas";

export function buildExecutionPlan(opp: ArbitrageOpportunity) {
    // Logic: Always place the POSITIVE EDGE bet first?
    // The Prompt says: "Determine positive-edge side" and "Always place the POSITIVE EDGE bet first".
    // However, usually in arb both sides are positive edge relative to true odds if arb exists?
    // Or implies the side with the higher odds relative to market avg?
    // Simplification from prompt example: "first = opp.ExpectedProfitPercent > 0 ? opp.SideA : opp.SideB"
    // Wait, ExpectedProfitPercent is a property of the whole arb.
    // Let's assume user meant "Check which side is driving the arb" or simply "Pick one deterministically or by highest odds".

    // Re-reading prompt snippet:
    // "const first = opp.ExpectedProfitPercent > 0 ? opp.SideA : opp.SideB;"
    // This implies if profit > 0 (always true for arb input), SideA is first?
    // That seems like a default.

    // Let's refine based on typical arb logic: Place the bet on the "Soft" book first (the one with the mistake).
    // But we don't have true odds here to know which is soft.
    // If prompt snippet is literally `const first = opp.ExpectedProfitPercent > 0 ? opp.SideA : opp.SideB;` then SideA is always first for valid arbs.
    // I will follow the snippet but maybe add a comment.

    // Actually, standard practice: Place the bet with the HIGHER ODDS (relative to market) first, or the one likely to disappear.
    // For now, I will stick to the provided snippet logic: Defaults to SideA.

    const first = opp.SideA; // Defaulting to A as per snippet logic interpretation (since pct always > 0)
    const second = opp.SideB;

    return { first, second };
}
