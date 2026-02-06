import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryService } from '../discovery/discovery.service';
import { toDecimalOdds } from '../utils/oddsNormalizer';
import * as fs from 'fs';
import * as path from 'path';

export interface NormalizedMarket {
    key: string;       // EVENT_ID | TYPE | LINE
    eventId: string;
    type: 'FT_HDP' | 'HT_HDP' | 'FT_OU' | 'HT_OU';
    period: 'FT' | 'HT';
    line: number;
    selection: 'Home' | 'Away' | 'Over' | 'Under';
    odds: number;           // ALWAYS DECIMAL (>= 1.01)
    rawOdds?: number;       // Original HK odds for audit
    marketNameRaw: string;
    selectionId?: string | number;
}

@Injectable()
export class MarketService {
    private readonly logger = new Logger(MarketService.name);

    private logToDisk(msg: string) {
        try {
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
            const logPath = path.join(logDir, 'forensic_debug.log');
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
        } catch (e) { }
    }

    private stats = {
        totalNormalized: 0,
        lastActive: 0
    };

    constructor(
        private discovery: DiscoveryService
    ) { }

    public getStats() {
        return this.stats;
    }

    /**
     * Entry point for strict market normalization.
     * Returns NormalizedMarket or null if rejected.
     */
    /**
     * Entry point for strict market normalization.
     * Returns NormalizedMarket[] (Empty if rejected or no bound event)
     */
    public normalizeMarket(provider: string, raw: any): NormalizedMarket[] {
        // 🔍 DEBUG ENTRY POINT
        console.log(`[MARKET-ENTRY] provider=${provider} rawKeys=${Object.keys(raw || {}).join(',')}`);
        this.logToDisk(`[MARKET-ENTRY] provider=${provider} raw=${JSON.stringify(raw).substring(0, 300)}`);
        
        // 1. Resolve Global Event ID
        const home = (raw.HomeName || raw.home || raw.h || raw.Home || raw.H || raw.ht || raw.HT || raw.HomeTeam || raw.hTeam || '').trim();
        const away = (raw.AwayName || raw.away || raw.a || raw.Away || raw.A || raw.at || raw.AT || raw.AwayTeam || raw.aTeam || '').trim();
        let rawEventId = String(raw.Matchid || raw.matchId || raw.id || raw.MatchId || raw.EventId || '');
        const isDummyId = !rawEventId || rawEventId.length < 3 || /^\d+\.\d+$/.test(rawEventId) || rawEventId === '0';

        if (isDummyId) {
            rawEventId = (home && away ? `${home}_vs_${away}`.replace(/\s+/g, '_').toLowerCase() : '');
        }

        if (!rawEventId) {
            this.logger.warn(`[MARKET-REJECT] provider=${provider} reason=EMPTY_IDENTITY`);
            return [];
        }

        const globalIds = this.discovery.resolveGlobalEventId(provider, rawEventId);

        // 🛡️ v8.5 [STRICT]: Fail-Fast. If we reach here, globalIds is guaranteed to be non-empty or an error was thrown.

        // 2. Identify Classification (Strict)
        // Permissive fallback: if the payload contains an `Odds`/`odds` array but lacks explicit market metadata,
        // attempt a direct normalization producing Home/Away entries so dummy/sample streams are accepted.
        const oddsArr = Array.isArray(raw?.Odds) ? raw.Odds : (Array.isArray(raw?.odds) ? raw.odds : null);
        if ((raw?.market == null || String(raw.market).trim() === '') && oddsArr && oddsArr.length >= 2) {
            const results: NormalizedMarket[] = [];
            for (const gid of globalIds) {
                // choose first as Home, last (or second) as Away
                const homeRaw = oddsArr[0];
                const awayRaw = oddsArr.length >= 2 ? oddsArr[oddsArr.length - 1] : oddsArr[1];

                const homeRawVal = typeof homeRaw === 'object' ? (homeRaw.Price ?? homeRaw.price ?? homeRaw.odds ?? homeRaw.p) : homeRaw;
                const awayRawVal = typeof awayRaw === 'object' ? (awayRaw.Price ?? awayRaw.price ?? awayRaw.odds ?? awayRaw.p) : awayRaw;

                const homeRawNum = parseFloat(String(homeRawVal));
                const awayRawNum = parseFloat(String(awayRawVal));

                const homeDecimal = toDecimalOdds(homeRawNum);
                const awayDecimal = toDecimalOdds(awayRawNum);

                if (homeDecimal && homeDecimal >= 1.01) {
                    const marketKey = `${gid}|FT_HDP|0`;
                    results.push({
                        key: marketKey,
                        eventId: gid,
                        type: 'FT_HDP',
                        period: 'FT',
                        line: 0,
                        selection: 'Home',
                        odds: homeDecimal,
                        rawOdds: homeRawNum,
                        marketNameRaw: 'INFERRED_FROM_ODDS'
                    });
                    this.logger.log(`[MARKET-NORMAL] Inferred Home market GlobalID=${gid.substring(0,8)} odds=${homeDecimal} provider=${provider}`);
                }

                if (awayDecimal && awayDecimal >= 1.01) {
                    const marketKey = `${gid}|FT_HDP|0`;
                    results.push({
                        key: marketKey,
                        eventId: gid,
                        type: 'FT_HDP',
                        period: 'FT',
                        line: 0,
                        selection: 'Away',
                        odds: awayDecimal,
                        rawOdds: awayRawNum,
                        marketNameRaw: 'INFERRED_FROM_ODDS'
                    });
                    this.logger.log(`[MARKET-NORMAL] Inferred Away market GlobalID=${gid.substring(0,8)} odds=${awayDecimal} provider=${provider}`);
                }
            }

            if (results.length > 0) {
                this.stats.totalNormalized += results.length;
                this.stats.lastActive = Date.now();
            }

            return results;
        }

        let classification = this.classifyMarket(raw);

        // If top-level classification failed, but there is a `Markets` array,
        // attempt to normalize each market entry individually.
        if (!classification && Array.isArray(raw?.Markets) && raw.Markets.length > 0) {
            const results: NormalizedMarket[] = [];
            for (const marketObj of raw.Markets) {
                try {
                    // Build a synthetic raw object for classification/normalization
                    const mr: any = Object.assign({}, raw, marketObj);
                    // Ensure market name fields are present for classifyMarket
                    mr.market = marketObj.MarketName || marketObj.market || marketObj.MarketType || mr.market;

                    const cls = this.classifyMarket(mr);
                    if (!cls) continue;

                    const line = this.extractLine(mr, cls.type);
                    if (line === null) continue;

                    // Determine selection/odds per market: iterate selections or Odds/Prices
                    const selections = marketObj.Selections || marketObj.Odds || marketObj.Prices || [];
                    if (!Array.isArray(selections) || selections.length === 0) continue;

                    for (const sel of selections) {
                        const selName = (sel.SelectionName || sel.name || sel.label || sel.selection || '').toString();
                        const rawOddVal = sel.Price ?? sel.price ?? sel.odds ?? sel.odd ?? sel.p ?? sel.value ?? sel;
                        const rawOddNum = parseFloat(String(rawOddVal));
                        const dec = toDecimalOdds(rawOddNum);
                        if (!dec || dec < 1.01) continue;
                            const normSel = this.normalizeSelection(selName || raw.selection || '', cls.category, home, away);
                            if (!normSel) continue;

                            const selId = sel?.Oddsid ?? sel?.OddsId ?? sel?.SelectionId ?? sel?.Id ?? sel?.id ?? sel?.SelId ?? sel?.OddId;

                            for (const gid of globalIds) {
                                const marketKey = `${gid}|${cls.type}|${line}`;
                                results.push({
                                    key: marketKey,
                                    eventId: gid,
                                    type: cls.type,
                                    period: cls.period,
                                    line: line,
                                    selection: normSel,
                                    odds: dec,
                                    rawOdds: rawOddNum,
                                    marketNameRaw: mr.market || marketObj.MarketName || 'MARKETS_INFER',
                                    selectionId: selId
                                });
                            }
                    }
                } catch (e) { continue; }
            }

            if (results.length > 0) {
                this.stats.totalNormalized += results.length;
                this.stats.lastActive = Date.now();
            }

            if (results.length > 0) return results;
        }

        if (!classification) {
            this.logger.warn(`[MARKET-REJECT] provider=${provider} rawId="${rawEventId}" market="${raw.market || 'unknown'}" reason=NOT_SUPPORTED_TYPE`);
            return [];
        }

        // 3. Normalize Line
        const normLine = this.extractLine(raw, classification.type);
        if (normLine === null) {
            this.logger.warn(`[MARKET-REJECT] provider=${provider} rawId="${rawEventId}" market="${raw.market}" reason=INVALID_LINE`);
            return [];
        }

        // 4. Normalize Selection
        const normSelection = this.normalizeSelection(raw.selection, classification.category, home, away);
        if (!normSelection) {
            this.logger.warn(`[MARKET-REJECT] provider=${provider} rawId="${rawEventId}" selection="${raw.selection}" reason=INVALID_SELECTION`);
            return [];
        }

        // 5. 🔥 NORMALIZE ODDS: HK → DECIMAL
        const rawOddsValue = parseFloat(raw.odds);
        if (isNaN(rawOddsValue)) {
            this.logger.warn(`[MARKET-REJECT] provider=${provider} rawId="${rawEventId}" odds="${raw.odds}" reason=INVALID_ODDS`);
            return [];
        }

        const decimalOdds = toDecimalOdds(rawOddsValue);
        if (!decimalOdds || decimalOdds < 1.01) {
            this.logger.warn(`[MARKET-REJECT] provider=${provider} rawId="${rawEventId}" decimalOdds=${decimalOdds} reason=ODDS_TOO_LOW`);
            return [];
        }

        const results: NormalizedMarket[] = [];

        for (const gid of globalIds) {
            // 6. Build Canonical Signature per Global ID
            const marketKey = `${gid}|${classification.type}|${normLine}`;

            const topSelId = raw?.Oddsid ?? raw?.OddsId ?? raw?.SelectionId ?? raw?.Id ?? raw?.id ?? undefined;

            results.push({
                key: marketKey,
                eventId: gid,
                type: classification.type,
                period: classification.period,
                line: normLine,
                selection: normSelection,
                odds: decimalOdds,           // ✅ DECIMAL ODDS
                rawOdds: rawOddsValue,       // Original HK for audit
                marketNameRaw: raw.market,
                selectionId: topSelId
            });

            // [MARKET-NORMAL] MANDATORY LOG
            console.log(`[MARKET-NORMAL] GlobalID=${gid.substring(0, 8)} type=${classification.type} side=${normSelection} line=${normLine} odds=${decimalOdds} provider=${provider}`);

            // 🔍 INSTRUMENTATION: Log accepted market with all details
            const normalMsg = `[MARKET-NORMAL] GlobalID=${gid.substring(0, 8)} type=${classification.type} side=${normSelection} line=${normLine} odds=${decimalOdds.toFixed(3)} provider=${provider}`;
            this.logger.log(normalMsg);
            this.logToDisk(normalMsg);
        }

        if (results.length > 0) {
            this.stats.totalNormalized += results.length;
            this.stats.lastActive = Date.now();
        }

        return results;
    }

    private classifyMarket(raw: any): { type: 'FT_HDP' | 'HT_HDP' | 'FT_OU' | 'HT_OU', category: 'HDP' | 'OU', period: 'FT' | 'HT' } | null {
        // 0. CHECK IF ALREADY NORMALIZED
        const marketRaw = (raw.market || '').toUpperCase().trim();
        if (marketRaw === 'FT_HDP') return { type: 'FT_HDP', period: 'FT', category: 'HDP' };
        if (marketRaw === 'HT_HDP') return { type: 'HT_HDP', period: 'HT', category: 'HDP' };
        if (marketRaw === 'FT_OU') return { type: 'FT_OU', period: 'FT', category: 'OU' };
        if (marketRaw === 'HT_OU') return { type: 'HT_OU', period: 'HT', category: 'OU' };

        const rawType = raw.market || raw.MarketName || raw.BetType || raw.betType || raw.MarketType || '';
        const str = String(rawType).toUpperCase();

        // 1. REJECT Explicit Junk
        if (str.includes('CORNER') || str.includes('BOOKING') || str.includes('CARD')) return null;

        // 2. SABA/ISPORT Numeric Codes
        if (str === '1' || str === 'HDP') return { type: 'FT_HDP', category: 'HDP', period: 'FT' };
        if (str === '2' || str === 'OU' || str === 'TOTAL') return { type: 'FT_OU', category: 'OU', period: 'FT' };
        if (str === '7' || str === 'HT HDP') return { type: 'HT_HDP', category: 'HDP', period: 'HT' };
        if (str === '8' || str === 'HT OU') return { type: 'HT_OU', category: 'OU', period: 'HT' };

        // 3. String Fallback
        let period: 'FT' | 'HT' = 'FT';
        if (str.includes('HT') || str.includes('1H') || str.includes('1ST HALF') || str.includes('FIRST HALF')) {
            period = 'HT';
        }
        if (str.includes('2H') || str.includes('2ND HALF')) return null;

        let category: 'HDP' | 'OU' | null = null;
        if (str.includes('OVER') || str.includes('UNDER') || str.includes('O/U') || str.includes('TOTAL')) {
            category = 'OU';
        } else if (str.includes('HDP') || str.includes('HANDICAP') || str.includes('ASIAN') || str.includes('SPREAD') || str.includes('HDCP')) {
            category = 'HDP';
        }
        // Ambiguous Fallback: Check selection
        else {
            const sel = (raw.selection || '').toUpperCase();
            if (sel === 'HOME' || sel === 'AWAY' || sel === '1' || sel === '2') category = 'HDP';
            if (sel === 'OVER' || sel === 'UNDER') category = 'OU';
        }

        if (!category) return null;

        const type = `${period}_${category}` as any;
        return { type, period, category };
    }

    private extractLine(raw: any, type: string): number | null {
        // Collect potential line sources - expanded list for CMD368 compatibility
        const candidates = [
            raw.DisplayHDP, // ISPORT/SABA
            raw.Line,       // ISPORT/SABA
            raw.line,
            raw.handicap,
            raw.hdp,
            raw.Hdp1,       // SABA Partial
            raw.point,
            raw.oddsName,
            raw.selection
        ];

        for (const val of candidates) {
            if (val === undefined || val === null) continue;

            // Normalize: Uppercase, Trim, Comma->Dot, Remove Parens/Quotes, Remove Spaces
            let s = String(val).toUpperCase()
                .trim()
                .replace(/["'()]/g, '')   // Remove quotes/parens
                .replace(/,/g, '.')       // 2,5 -> 2.5
                .replace(/\s+/g, '');     // Remove all spaces (2.5 / 3.0 -> 2.5/3.0)

            // Cleanup Keywords
            s = s.replace('OVER', '').replace('UNDER', '');

            // 0. Explicit Zero / Level
            if (s === 'LEVEL' || s === 'PK' || s === '0' || s === '0.0') return 0;

            // 1. Slash Format: "0/0.5", "2.5/3.0"
            if (s.includes('/')) {
                const parts = s.split('/');
                if (parts.length === 2) {
                    const n1 = parseFloat(parts[0]);
                    const n2 = parseFloat(parts[1]);
                    if (!isNaN(n1) && !isNaN(n2)) {
                        return (n1 + n2) / 2;
                    }
                }
            }

            // 2. Dash Format: "0-0.5", "-0.5-1"
            // Regex to capture: (Number1)-(Number2)
            // Supports negative start: -0.5-1
            const dashMatch = s.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/);
            if (dashMatch) {
                let n1 = parseFloat(dashMatch[1]);
                let n2 = parseFloat(dashMatch[2]);

                if (!isNaN(n1) && !isNaN(n2)) {
                    // Fix for negative quarter lines logic: "-0.5-1" -> -0.75
                    // If n1 is negative and n2 is positive, and they are clearly a quarter line pair,
                    // enforce n2 to be negative (inherits sign).
                    if (n1 < 0 && n2 > 0) {
                        n2 = -n2;
                    }
                    return (n1 + n2) / 2;
                }
            }

            // 3. Simple Number
            if (/^-?\d+(\.\d+)?$/.test(s)) {
                return parseFloat(s);
            }
        }

        return null;
    }

    private normalizeSelection(sel: string, category: 'HDP' | 'OU', home?: string, away?: string): 'Home' | 'Away' | 'Over' | 'Under' | null {
        const s = (sel || '').toUpperCase();
        const h = (home || '').toUpperCase();
        const a = (away || '').toUpperCase();

        if (category === 'OU') {
            if (s.includes('OVER') || /\bO\b/.test(s)) return 'Over';
            if (s.includes('UNDER') || /\bU\b/.test(s)) return 'Under';
            // sometimes selection may be numeric '1.5' etc - not meaningful for OU side
        } else {
            // Handicap: check explicit keywords
            if (s.includes('HOME') || s.includes('HOME') || s.includes('1')) return 'Home';
            if (s.includes('AWAY') || s.includes('2')) return 'Away';

            // If selection contains team name, match against provided home/away
            if (h && s.includes(h)) return 'Home';
            if (a && s.includes(a)) return 'Away';

            // Short tokens
            if (s === '1' || s === 'H') return 'Home';
            if (s === '2' || s === 'A') return 'Away';
        }
        return null;
    }
}
