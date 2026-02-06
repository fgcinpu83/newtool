import { HarmonizedMarket } from "./schemas";
import { isOppositeSide } from "./harmonizationRules";
import { NormalizedMarket } from "../normalization/schemas";

export function pairMarkets(group: NormalizedMarket[]): HarmonizedMarket | null {
    const A = group.filter(x => x.Provider === "A");
    const B = group.filter(x => x.Provider === "B");

    if (A.length < 2 || B.length < 2) return null;

    const result: HarmonizedMarket = {
        GlobalEventID: group[0].GlobalEventID,
        MarketType: group[0].MarketType,
        Line: group[0].Line!, // Validator ensures line is number
        ProviderA: {},
        ProviderB: {}
    };

    for (const m of A) result.ProviderA[m.Selection] = m.Odds;
    for (const m of B) result.ProviderB[m.Selection] = m.Odds;

    const sidesA = Object.keys(result.ProviderA);
    const sidesB = Object.keys(result.ProviderB);

    // Must have exactly 2 sides per provider
    if (sidesA.length !== 2 || sidesB.length !== 2) return null;
    // Sides must be opposites
    if (!isOppositeSide(sidesA[0], sidesA[1])) return null;
    if (!isOppositeSide(sidesB[0], sidesB[1])) return null;

    return result;
}
