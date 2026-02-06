import { indexMarkets } from "./marketIndexer";
import { pairMarkets } from "./marketPairer";
import { NormalizedMarket } from "../normalization/schemas";
import { HarmonizedMarket } from "./schemas";

export function harmonize(normalizedMarkets: NormalizedMarket[]): HarmonizedMarket[] {
    const indexed = indexMarkets(normalizedMarkets);
    const results: HarmonizedMarket[] = [];

    for (const [, group] of indexed.entries()) {
        const pair = pairMarkets(group);
        if (pair) results.push(pair);
    }

    return results;
}
