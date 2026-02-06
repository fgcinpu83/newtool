import { mapToNormalizedMarket } from "./marketMapper";
import { validateMarket } from "./marketValidator";
import { NormalizedMarket } from "./schemas";

export function normalizeProviderMarkets(
    rawMarkets: any[],
    provider: string,
    globalEventId: string
): NormalizedMarket[] {
    const mapped = mapToNormalizedMarket(rawMarkets, provider, globalEventId);
    // Filter only valid markets
    return mapped.filter(validateMarket);
}
