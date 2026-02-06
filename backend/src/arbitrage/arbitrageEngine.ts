import { detectArbitrage } from "./arbitrageDetector";
import { calculateStakes } from "./stakeCalculator";
import { ArbitrageOpportunity } from "./schemas";
import { HarmonizedMarket } from "../harmonization/schemas";

type Selection = "HOME" | "AWAY" | "OVER" | "UNDER";

interface SideInfo {
    Provider: "A" | "B";
    Selection: Selection;
    Odds: number;
}

export function evaluateMarket(h: HarmonizedMarket): ArbitrageOpportunity | null {
    // Determine relevant sides based on market type or content
    // FT_HDP/HT_HDP -> HOME/AWAY
    // FT_OU/HT_OU -> OVER/UNDER

    // We can infer from Provider keys.
    const sidesA = Object.keys(h.ProviderA) as Selection[];
    const sidesB = Object.keys(h.ProviderB) as Selection[];
    const allSides = Array.from(new Set([...sidesA, ...sidesB]));

    let pairs: [Selection, Selection] | null = null;
    if (allSides.includes("HOME") && allSides.includes("AWAY")) pairs = ["HOME", "AWAY"];
    else if (allSides.includes("OVER") && allSides.includes("UNDER")) pairs = ["OVER", "UNDER"];

    if (!pairs) return null; // Should not happen if harmonization is correct

    const [sel1, sel2] = pairs;

    const side1 = pickBestSide(h, sel1);
    const side2 = pickBestSide(h, sel2);

    if (!side1 || !side2) return null;

    // Detect Arb
    const totalP = detectArbitrage(side1.Odds, side2.Odds);
    if (!totalP) return null;

    // Calculate Stakes
    const { stake1, stake2 } = calculateStakes(side1.Odds, side2.Odds);

    // Validate negative stakes (impossible with math above but good specific check from prompt rules)
    if (stake1 <= 0 || stake2 <= 0) return null;

    return {
        GlobalEventID: h.GlobalEventID,
        MarketType: h.MarketType,
        Line: h.Line,

        SideA: {
            Provider: side1.Provider,
            Selection: side1.Selection,
            Odds: side1.Odds,
            Stake: stake1
        },

        SideB: {
            Provider: side2.Provider,
            Selection: side2.Selection,
            Odds: side2.Odds,
            Stake: stake2
        },

        TotalProbability: totalP,
        ExpectedProfitPercent: (1 - totalP) * 100
    };
}

function pickBestSide(h: HarmonizedMarket, selection: Selection): SideInfo | null {
    const oddsA = h.ProviderA[selection];
    const oddsB = h.ProviderB[selection];

    if (oddsA === undefined && oddsB === undefined) return null;

    // If only one exists
    if (oddsA !== undefined && oddsB === undefined) return { Provider: "A", Selection: selection, Odds: oddsA };
    if (oddsA === undefined && oddsB !== undefined) return { Provider: "B", Selection: selection, Odds: oddsB };

    // Both exist, pick best (highest)
    // Typescript check for undefined done above.
    if (oddsA! > oddsB!) {
        return { Provider: "A", Selection: selection, Odds: oddsA! };
    } else {
        return { Provider: "B", Selection: selection, Odds: oddsB! };
    }
}
