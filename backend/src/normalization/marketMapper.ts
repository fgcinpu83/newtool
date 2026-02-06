import { NormalizedMarket, MarketType, Selection } from "./schemas";
import { MARKET_RULES } from "./marketRules";

export function mapToNormalizedMarket(
    rawMarkets: any[],
    provider: string,
    globalEventId: string
): NormalizedMarket[] {
    const normalized: NormalizedMarket[] = [];

    for (const raw of rawMarkets) {
        let market: NormalizedMarket | null = null;

        if (typeof raw === 'string') {
            market = parseMarketString(raw, provider, globalEventId);
        } else if (typeof raw === 'object' && raw !== null) {
            market = parseMarketObject(raw, provider, globalEventId);
        }

        if (market) {
            normalized.push(market);
        }
    }

    return normalized;
}

function parseMarketObject(
    obj: any,
    provider: string,
    globalEventId: string
): NormalizedMarket | null {
    // 1. Detect Market Type
    let marketType: MarketType | null = null;
    const typeStr = (obj.market || obj.type || obj.m || "").toLowerCase();

    if (checkKeywords(typeStr, MARKET_RULES.HT_HDP) || (typeStr.includes('hdp') && (obj.period === '1H' || typeStr.includes('1h')))) marketType = "HT_HDP";
    else if (checkKeywords(typeStr, MARKET_RULES.HT_OU) || (typeStr.includes('ou') && (obj.period === '1H' || typeStr.includes('1h')))) marketType = "HT_OU";
    else if (checkKeywords(typeStr, MARKET_RULES.FT_HDP) || typeStr.includes('hdp')) marketType = "FT_HDP";
    else if (checkKeywords(typeStr, MARKET_RULES.FT_OU) || typeStr.includes('ou')) marketType = "FT_OU";

    if (!marketType) return null;

    // 2. Extract Odds
    const odds = parseFloat(obj.odds || obj.o || obj.price);
    if (isNaN(odds)) return null;

    // 3. Extract Line
    let line: number | null = null;
    const lineRaw = obj.line || obj.l || obj.hdp || obj.point || obj.handicap;

    if (typeof lineRaw === 'number') {
        line = lineRaw;
    } else if (typeof lineRaw === 'string') {
        // Use our robust string parser for the line value specifically
        // Mock a raw string "HDP [line]" to reuse extracting logic? No, extract directly.
        // Copy-paste robust logic here or split parsing logic. 
        // Better: simple extraction for just the line string using the regex.
        let safeLineStr = lineRaw.toLowerCase().replace(/,/g, '.');
        if (/\bpk\b/.test(safeLineStr) || /\blevel\b/.test(safeLineStr)) {
            line = 0;
        } else {
            const quarterRegex = /([-+]?\d+(\.\d+)?)\s*[\/]\s*([-+]?\d+(\.\d+)?)/;
            const standardRegex = /([-+]?\d+(\.\d+)?)/g;
            const qMatch = safeLineStr.match(quarterRegex);
            if (qMatch) {
                line = (parseFloat(qMatch[1]) + parseFloat(qMatch[3])) / 2;
            } else {
                const matches = safeLineStr.match(standardRegex);
                if (matches && matches.length > 0) line = parseFloat(matches[0]);
            }
        }
    }

    // 4. Selection
    let selection: Selection | null = null;
    const selStr = (obj.selection || obj.s || obj.pick || "").toLowerCase();
    if (selStr.includes('home')) selection = "HOME";
    else if (selStr.includes('away')) selection = "AWAY";
    else if (selStr.includes('over')) selection = "OVER";
    else if (selStr.includes('under')) selection = "UNDER";

    // 5. Validation/Cleanup common block
    if (line === null || isNaN(line)) return null;
    if (marketType.includes("OU")) line = Math.abs(line);
    if (!selection) return null;

    // Ensure selection consistency
    if (marketType.includes("OU") && (selection !== 'OVER' && selection !== 'UNDER')) return null;
    if (marketType.includes("HDP") && (selection !== 'HOME' && selection !== 'AWAY')) return null;

    return {
        GlobalEventID: globalEventId,
        MarketType: marketType,
        Line: line,
        Selection: selection,
        Odds: odds,
        Provider: provider
    };
}

function parseMarketString(
    raw: string,
    provider: string,
    globalEventId: string
): NormalizedMarket | null {
    const lower = raw.toLowerCase();

    // 1. Detect Market Type
    let marketType: MarketType | null = null;

    // Check HT first (most specific)
    if (checkKeywords(lower, MARKET_RULES.HT_HDP)) marketType = "HT_HDP";
    else if (checkKeywords(lower, MARKET_RULES.HT_OU)) marketType = "HT_OU";
    else if (checkKeywords(lower, MARKET_RULES.FT_HDP)) marketType = "FT_HDP";
    else if (checkKeywords(lower, MARKET_RULES.FT_OU)) marketType = "FT_OU";

    if (!marketType) return null;

    // 2. Extract Odds (looks for @1.92 format)
    const oddsMatch = raw.match(/@\s*(\d+(\.\d+)?)/);
    if (!oddsMatch) return null;
    const odds = parseFloat(oddsMatch[1]);
    if (isNaN(odds)) return null;

    // 3. Extract Selection and Line
    let selection: Selection | null = null;
    let line: number | null = null;

    // Remove the odds part to avoid confusion
    const textWithoutOdds = raw.replace(oddsMatch[0], "").trim();

    // -- SELECTION DETECTION --
    if (/\bover\b/i.test(textWithoutOdds) || /\bov\b/i.test(textWithoutOdds) || /o\s*\//i.test(textWithoutOdds)) selection = "OVER";
    else if (/\bunder\b/i.test(textWithoutOdds) || /\bun\b/i.test(textWithoutOdds) || /u\s*\//i.test(textWithoutOdds)) selection = "UNDER";
    else if (/\bhome\b/i.test(textWithoutOdds)) selection = "HOME";
    else if (/\baway\b/i.test(textWithoutOdds)) selection = "AWAY";

    // Fallback Selection for HDP: If line starts with -, typically AWAY favored? No, usually line is relative to selection.
    // Provider specific logic might be needed later if selection is missing, but for now strict reject if no selection keyword found.

    // -- LINE EXTRACTION ROBUST LOGIC --
    // Supports:
    // 0, 0.5, -0.5, +0.5
    // 0.5/1, 0-0.5, 0/0.5 (Quarter lines)
    // 2.5, 2,5 (Comma)
    // pk, level (0)

    // Regex Explanation:
    // [-+]?       Optional sign
    // \d+         Integer part
    // ([.,]\d+)?  Optional decimal part (dot or comma)
    // (           Start Group for Quarter line part
    //   [\/-]     Separator (/ or - or space sometimes, strictly / or - for now)
    //   \d+       Integer part 2
    //   ([.,]\d+)? Optional decimal part 2
    // )?          Group is optional

    // Normalize string for easier regex: replace comma with dot
    let safeLineStr = textWithoutOdds.toLowerCase().replace(/,/g, '.');

    // Special cases
    if (/\bpk\b/.test(safeLineStr) || /\blevel\b/.test(safeLineStr)) {
        line = 0;
    } else {
        // Regex for parsing line
        const quarterRegex = /([-+]?\d+(\.\d+)?)\s*[\/]\s*([-+]?\d+(\.\d+)?)/; // Matches 0.5/1
        const standardRegex = /([-+]?\d+(\.\d+)?)/g; // Matches 0.5, -1, 2.5

        const qMatch = safeLineStr.match(quarterRegex);
        if (qMatch) {
            // Quarter Line: (L1 + L2) / 2
            // e.g. 0.5/1 -> (0.5 + 1.0) / 2 = 0.75
            // e.g. 1/1.5 -> (1 + 1.5) / 2 = 1.25
            const l1 = parseFloat(qMatch[1]);
            const l2 = parseFloat(qMatch[3]);
            line = (l1 + l2) / 2;
        } else {
            // Standard Line
            // Find all numbers that are likely lines.
            // Exclude common integers like '1st' (1) if possible, but keywords removed?
            // HDP usually has sign, OU usually positive.

            const matches = safeLineStr.match(standardRegex);
            if (matches && matches.length > 0) {
                // Heuristic:
                // If HDP, look for signed numbers first, or numbers at end?
                // If OU, look for typical total goals (0.5 - 10.0).

                // If we have explicit selection 'OVER 2.5', the number adjacent to selection is best.
                // For now, take the LAST number found that isn't excessively huge (like an ID).

                for (let i = matches.length - 1; i >= 0; i--) {
                    const val = parseFloat(matches[i]);
                    // Filter out likely non-line numbers (dates, huge IDs)
                    if (Math.abs(val) < 50) {
                        line = val;
                        break;
                    }
                }
            }
        }
    }

    // VALIDATION & CLEANUP
    if (line === null || isNaN(line)) {
        return null;
    }

    // Selection Logic checks
    if (!selection) return null;

    if (marketType.includes("OU")) {
        if (selection !== "OVER" && selection !== "UNDER") return null;
        // OU lines are generally positive, but some providers use negative to indicate Under favored? 
        // For normalization, usually we expect absolute value for the line in O/U (e.g. 2.5), 
        // the selection determines the side.
        line = Math.abs(line);
    }

    if (marketType.includes("HDP")) {
        if (selection !== "HOME" && selection !== "AWAY") return null;
    }

    return {
        GlobalEventID: globalEventId,
        MarketType: marketType,
        Line: line,
        Selection: selection,
        Odds: odds,
        Provider: provider
    };
}

function checkKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(k => text.includes(k));
}
