import { NormalizedMarket } from "../normalization/schemas";

export function indexMarkets(markets: NormalizedMarket[]) {
    const map = new Map<string, NormalizedMarket[]>();

    for (const m of markets) {
        const key = `${m.GlobalEventID}|${m.MarketType}|${m.Line}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(m);
    }

    return map;
}
