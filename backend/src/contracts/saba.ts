export interface ParsedMatch {
    matchId: string | number;
    home?: string;
    away?: string;
    odds?: number[];
    raw?: any;
}

export interface Selection {
    id?: string | number;
    name?: string;
    odds?: number;
    raw?: any;
}

export function parseSaba(body: string | object): ParsedMatch[] {
    let obj: any = body;
    if (typeof body === 'string') {
        try { obj = JSON.parse(body); } catch (e) { obj = { raw: body }; }
    }

    const out: ParsedMatch[] = [];
    const list = obj?.d?.MatchList || obj?.MatchList || obj?.matches || obj?.data?.MatchList || obj?.data || obj || null;
    if (!list || !Array.isArray(list)) return out;

    function toNum(v: any): number {
        if (v == null) return NaN;
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
            const s = v.replace(',', '.').replace(/[^0-9.\-]/g, '');
            return Number(s);
        }
        return Number(v);
    }

    function extractOddsAndSelections(arr: any[], sels: Selection[]): number[] {
        const res: number[] = [];
        for (const item of arr) {
            if (item == null) continue;
            // primitive value
            if (typeof item === 'number' || typeof item === 'string') {
                const n = toNum(item);
                if (!Number.isNaN(n)) res.push(n);
                continue;
            }

            // try to read numeric price from known keys
            const price = (item.Price ?? item.price ?? item.odds ?? item.odd ?? item.p);
            const n = toNum(price);
            if (!Number.isNaN(n)) res.push(n);

            // try to extract selection id/name
            const id = item.Oddsid ?? item.OddsId ?? item.SelectionId ?? item.Id ?? item.id ?? item.SelId ?? item.OddId;
            const name = item.Name ?? item.name ?? item.SelectionName ?? item.Option;
            if (id != null || name != null || !Number.isNaN(n)) {
                sels.push({ id: id ?? undefined, name: name ?? undefined, odds: Number.isFinite(n) ? n : undefined, raw: item });
            }
        }
        return res;
    }

    for (const m of list) {
        try {
            const matchId = m?.MatchId ?? m?.matchId ?? m?.id ?? m?.idMatch ?? m?.Id;
            const home = m?.HomeName || m?.home || m?.homeTeam || m?.HostName || null;
            const away = m?.AwayName || m?.away || m?.awayTeam || m?.GuestName || null;

            let odds: number[] = [];
            const selections: Selection[] = [];

            // direct Odds array
            if (Array.isArray(m?.Odds)) odds = odds.concat(extractOddsAndSelections(m.Odds, selections));

            // some payloads put Prices at match root or Markets -> Odds/Prices
            if (Array.isArray(m?.Prices)) odds = odds.concat(extractOddsAndSelections(m.Prices, selections));
            if (Array.isArray(m?.Markets)) {
                for (const market of m.Markets) {
                    if (Array.isArray(market?.Odds)) odds = odds.concat(extractOddsAndSelections(market.Odds, selections));
                    if (Array.isArray(market?.Prices)) odds = odds.concat(extractOddsAndSelections(market.Prices, selections));
                    // sometimes market has nested selections
                    if (Array.isArray(market?.Selections)) {
                        for (const sel of market.Selections) {
                            // selection may itself be an object with id/price
                            if (Array.isArray(sel?.Odds)) odds = odds.concat(extractOddsAndSelections(sel.Odds, selections));
                            // price on selection
                            if (sel?.Price != null || sel?.price != null || sel?.Oddsid != null || sel?.SelectionId != null) {
                                const n = toNum(sel.Price ?? sel.price ?? sel.Odds ?? sel.odd ?? sel.p);
                                const id = sel?.Oddsid ?? sel?.OddsId ?? sel?.SelectionId ?? sel?.Id ?? sel?.id;
                                const name = sel?.Name ?? sel?.name ?? sel?.SelectionName;
                                if (!Number.isNaN(n)) odds.push(n);
                                selections.push({ id: id ?? undefined, name: name ?? undefined, odds: Number.isFinite(n) ? n : undefined, raw: sel });
                            }
                        }
                    }
                }
            }

            // single-price fields
            if ((m?.Price != null || m?.price != null)) {
                const n = toNum(m.Price ?? m.price);
                if (!Number.isNaN(n)) {
                    odds.push(n);
                    // attempt to capture id/name at match root
                    const id = m?.Oddsid ?? m?.OddsId ?? m?.SelectionId ?? m?.Id ?? m?.id;
                    const name = m?.Name ?? m?.name;
                    if (id != null || name != null) selections.push({ id: id ?? undefined, name: name ?? undefined, odds: n, raw: m });
                }
            }

            // normalize odds: remove NaN, non-positive, dedupe
            odds = (odds || []).map(x => Number(x)).filter(x => Number.isFinite(x) && x > 0);
            const seen = new Set<number>();
            const uniq: number[] = [];
            for (const o of odds) { if (!seen.has(o)) { seen.add(o); uniq.push(o); } }

            out.push({ matchId, home, away, odds: uniq, raw: m, ...(selections.length ? { selections } : {}) });
        } catch (e) {
            // swallow and continue
            continue;
        }
    }

    return out;
}
