
// Mock Rules and Types to match marketMapper.ts context
const MARKET_RULES = {
    HT_HDP: ['1st', 'htt', '1h hdp', 'ht hdp', 'first half handicap'],
    HT_OU: ['1st', 'htt', '1h ou', 'ht ou', 'first half over'],
    FT_HDP: ['hdp', 'handicap', 'asian handicap'],
    FT_OU: ['ou', 'over', 'under', 'total']
};

function checkKeywords(text, keywords) {
    return keywords.some(k => text.includes(k));
}

function parseMarketString(raw, provider, globalEventId) {
    const lower = raw.toLowerCase();

    // 1. Detect Market Type
    let marketType = null;
    if (checkKeywords(lower, MARKET_RULES.HT_HDP) && checkKeywords(lower, ['hdp', 'handicap'])) marketType = "HT_HDP";
    else if (checkKeywords(lower, MARKET_RULES.HT_OU) && checkKeywords(lower, ['ou', 'over', 'under'])) marketType = "HT_OU";
    else if (checkKeywords(lower, MARKET_RULES.FT_HDP)) marketType = "FT_HDP";
    else if (checkKeywords(lower, MARKET_RULES.FT_OU)) marketType = "FT_OU";

    if (!marketType) return { error: "UNKNOWN_TYPE" };

    // 2. Extract Odds
    let workingRaw = raw;
    if (!raw.includes('@')) workingRaw = raw + " @ 1.95";

    const oddsMatch = workingRaw.match(/@\s*(\d+(\.\d+)?)/);
    if (!oddsMatch) return { error: "NO_ODDS" };
    const odds = parseFloat(oddsMatch[1]);

    // 3. Extract Selection and Line
    let selection = null;
    let line = null;

    const textWithoutOdds = workingRaw.replace(oddsMatch[0], "").trim();

    // Selection
    if (/\bover\b/i.test(textWithoutOdds) || /\bov\b/i.test(textWithoutOdds) || /o\s*\//i.test(textWithoutOdds)) selection = "OVER";
    else if (/\bunder\b/i.test(textWithoutOdds) || /\bun\b/i.test(textWithoutOdds) || /u\s*\//i.test(textWithoutOdds)) selection = "UNDER";
    else if (/\bhome\b/i.test(textWithoutOdds)) selection = "HOME";
    else if (/\baway\b/i.test(textWithoutOdds)) selection = "AWAY";

    // Line Extraction
    let safeLineStr = textWithoutOdds.toLowerCase().replace(/,/g, '.');

    if (/\bpk\b/.test(safeLineStr) || /\blevel\b/.test(safeLineStr)) {
        line = 0;
    } else {
        const quarterRegex = /([-+]?\d+(\.\d+)?)\s*[\/]\s*([-+]?\d+(\.\d+)?)/;
        const standardRegex = /([-+]?\d+(\.\d+)?)/g;

        const qMatch = safeLineStr.match(quarterRegex);
        if (qMatch) {
            const l1 = parseFloat(qMatch[1]);
            const l2 = parseFloat(qMatch[3]);
            line = (l1 + l2) / 2;
        } else {
            const matches = safeLineStr.match(standardRegex);
            if (matches && matches.length > 0) {
                for (let i = matches.length - 1; i >= 0; i--) {
                    const val = parseFloat(matches[i]);
                    if (Math.abs(val) < 50) {
                        line = val;
                        break;
                    }
                }
            }
        }
    }

    if (line === null || isNaN(line)) return { error: "INVALID_LINE" };
    if (marketType.includes("OU")) line = Math.abs(line);

    return {
        MarketType: marketType,
        Line: line,
        Selection: selection,
        Odds: odds
    };
}

// Object Parser Simulation
function parseMarketObject(obj) {
    let marketType = null;
    const typeStr = (obj.market || obj.type || obj.m || "").toLowerCase();

    if (checkKeywords(typeStr, MARKET_RULES.HT_HDP) || (typeStr.includes('hdp') && (obj.period === '1H' || typeStr.includes('1h')))) marketType = "HT_HDP";
    else if (checkKeywords(typeStr, MARKET_RULES.HT_OU) || (typeStr.includes('ou') && (obj.period === '1H' || typeStr.includes('1h')))) marketType = "HT_OU";
    else if (checkKeywords(typeStr, MARKET_RULES.FT_HDP) || typeStr.includes('hdp')) marketType = "FT_HDP";
    else if (checkKeywords(typeStr, MARKET_RULES.FT_OU) || typeStr.includes('ou')) marketType = "FT_OU";

    // Fallback if generic 'HDP' or 'OU' without period
    if (!marketType && typeStr.includes('hdp')) marketType = "FT_HDP";
    if (!marketType && typeStr.includes('ou')) marketType = "FT_OU";

    if (!marketType) return { error: "UNKNOWN_TYPE (" + typeStr + ")" };

    const odds = parseFloat(obj.odds || obj.o || obj.price);
    if (isNaN(odds)) return { error: "INVALID_ODDS" };

    let line = null;
    const lineRaw = obj.line || obj.l || obj.hdp;

    if (typeof lineRaw === 'number') {
        line = lineRaw;
    } else if (typeof lineRaw === 'string') {
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

    let selection = null;
    const selStr = (obj.selection || obj.s || obj.pick || "").toLowerCase();
    if (selStr.includes('home')) selection = "HOME";
    else if (selStr.includes('away')) selection = "AWAY";
    else if (selStr.includes('over')) selection = "OVER";
    else if (selStr.includes('under')) selection = "UNDER";

    if (line === null || isNaN(line)) return { error: "INVALID_LINE (" + lineRaw + ")" };
    if (marketType.includes("OU")) line = Math.abs(line);

    return { MarketType: marketType, Line: line, Selection: selection, Odds: odds };
}

// TEST CASES
console.log("--- STRING PARSER TEST ---");
const cases = [
    "HDP -0.25 HOME",
    "Handicap (0.5/1) HOME",
    "Asian Handicap pk HOME",
    "O/U 2.5 OVER"
];
cases.forEach(c => {
    const result = parseMarketString(c, "TEST", "1");
    if (result.error) console.log(`FAIL STRING: "${c}" -> ERROR: ${result.error}`);
    else console.log(`PASS STRING: "${c}" -> Line: ${result.Line}`);
});

console.log("\n--- OBJECT PARSER TEST ---");
const objCases = [
    { market: "HDP", selection: "Home", odds: 1.95, line: -0.5 },
    { market: "HDP", selection: "Away", odds: 1.90, line: "0.5/1" },
    { market: "OU", selection: "Over", odds: 2.05, line: "2,5" },
    { market: "OU", selection: "Under", odds: 1.85, line: 3 },
    { market: "HDP", selection: "Home", odds: 0.9, line: "pk" }
];
objCases.forEach(o => {
    const result = parseMarketObject(o);
    if (result.error) console.log(`FAIL OBJECT: ${JSON.stringify(o)} -> ERROR: ${result.error}`);
    else console.log(`PASS OBJECT: ${JSON.stringify(o)} -> Line: ${result.Line}`);
});
