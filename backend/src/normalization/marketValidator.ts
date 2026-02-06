import { NormalizedMarket } from "./schemas";

export function validateMarket(m: NormalizedMarket): boolean {
    if (!m.GlobalEventID) return false;
    if (!m.MarketType) return false;
    // Use a small epsilon for float comparison or just strict check as requested. 
    // User said "Odds <= 1 return false". 
    if (m.Odds <= 1) return false;

    // All supported markets (HDP/OU) MUST have a numeric line
    if (typeof m.Line !== "number") return false;

    return true;
}
