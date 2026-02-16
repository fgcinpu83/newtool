import * as fs from 'fs';
import * as path from 'path';
import { EventIdentity } from '../../utils/identity.utils';

// 🛡️ v6.1 AGGRESSIVE PIPE RECONSTRUCTION
// Schema-Agnostic Parser with Fuzzy Key Matching

// RAW DATA MIRROR COUNTER
let rawMirrorCount = 0;
const MAX_RAW_MIRRORS = 3;

// NOTE: match cache removed from module scope to avoid shared mutable state.
// A local per-call cache will be used inside `parseAfbPacket` to preserve
// parser behaviour without global state.

// FUZZY KEY PATTERNS (case-insensitive)
const HOME_PATTERNS = /home|h_?name|hteam|team.?a|team.?1|ht|local|host|htnm/i;
const AWAY_PATTERNS = /away|a_?name|ateam|team.?b|team.?2|at|visitor|guest|atnm/i;
const ODDS_PATTERNS = /odds|price|rate|value|hdp|ou|line|over|under|decimal/i;
const MATCH_PATTERNS = /match|event|game|fixture|id/i;
const LEAGUE_PATTERNS = /league|comp|tournament|division|group|lgnm/i;

export function parseAfbPacket(obj: any): { odds: any[], balance: number | null } {
    // Per-call matchCache to avoid module-level mutable state
    const matchCache: Map<string, { home: string; away: string; league?: string; scheduledTime?: string }> = new Map();
    const MATCH_CACHE_MAX = 500;
    const MATCH_CACHE_TTL = 300000; // 5 minutes

    let odds: any[] = [];
    let balance: number | null = null;
    const wireLog = path.join(process.cwd(), 'logs', 'wire_debug.log');

    if (!obj) return { odds, balance };

    // 🛡️ v7.5: Handle raw string payloads from malformed JSON
    let workingObj = obj;
    if (typeof obj === 'string') {
        console.log(`[AFB-PARSER] 📄 Received raw string payload, length: ${obj.length}`);
        try {
            workingObj = JSON.parse(obj);
        } catch (e) {
            console.warn(`[AFB-PARSER] ❌ JSON parse failed: ${e.message}, attempting regex extraction`);
            // Attempt to extract data from malformed JSON string
            const extracted = extractFromMalformedJson(obj);
            if (extracted.odds.length > 0 || extracted.balance !== null) {
                console.log(`[AFB-PARSER] ✅ Regex extraction successful: ${extracted.odds.length} odds, balance: ${extracted.balance}`);
                return extracted;
            }
            return { odds: [], balance: null }; // Give up
        }
    }

    console.log(`[AFB-PARSER] 🔍 Parsing AFB data, type: ${typeof workingObj}, keys: ${Object.keys(workingObj).slice(0, 10).join(', ')}`);

    // 🎯 v7.4 AUDIT: Log db structure for error/js/db packets to find balance location
    if (obj.db && typeof obj.db === 'object') {
        const dbKeys = Object.keys(obj.db).slice(0, 20).join(', ');
        try { fs.appendFileSync(wireLog, `[${new Date().toISOString()}] [DB-STRUCTURE-AUDIT] Keys: ${dbKeys}\n`); } catch (e) { }
    }

    // 🎯 BALANCE EXTRACTION (v7.4 with detailed logging)
    const extractBalance = (target: any, depth = 0): number | null => {
        if (!target || typeof target !== 'object' || depth > 5) return null;

        const balanceKeys = ['balance', 'Balance', 'credit', 'Credit',
            'availableBalance', 'AvailableBalance', 'cash', 'Cash',
            'bal', 'Bal', 'available', 'Available', 'Amount', 'amount',
            'uBal', 'ubal', 'ba', 'Ba', 'BA', 'Balance2D', 'Balance2',
            'currentBalance', 'CurrentBalance', 'totalBalance', 'TotalBalance',
            'availBal', 'AvailBal', 'memberBal', 'MemberBal'];
        for (const key of balanceKeys) {
            if (target[key] !== undefined && target[key] !== null) {
                const rawVal = target[key];
                const val = parseFloat(String(rawVal).replace(/[^0-9.-]/g, ''));
                if (!isNaN(val)) {
                    try { fs.appendFileSync(wireLog, `[${new Date().toISOString()}] [BALANCE-HIT] Key=${key} RawVal=${rawVal} Parsed=${val}\n`); } catch (e) { }
                    return val;
                }
            }
        }

        const wrappers = ['db', 'user', 'data', 'account', 'js', 'result', 'response'];
        for (const w of wrappers) {
            if (target[w]) {
                if (Array.isArray(target[w])) {
                    // Scan array elements for balance
                    for (const item of target[w]) {
                        if (item && typeof item === 'object') {
                            const found = extractBalance(item, depth + 1);
                            if (found !== null) return found;
                        }
                    }
                } else if (typeof target[w] === 'object') {
                    const found = extractBalance(target[w], depth + 1);
                    if (found !== null) return found;
                }
            }
        }

        // 🛡️ Parse cookies for balance (AFB style)
        if (target.cookies && typeof target.cookies === 'string') {
            try {
                // Look for acctInfo JSON in cookies
                const acctInfoMatch = target.cookies.match(/acctInfo=([^;]+)/);
                if (acctInfoMatch) {
                    const acctInfo = JSON.parse(decodeURIComponent(acctInfoMatch[1]));
                    if (acctInfo.balance !== undefined) {
                        const val = parseFloat(acctInfo.balance);
                        if (!isNaN(val)) return val;
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        return null;
    };

    // 🎯 SABA/AFB88 Positional Array Extraction (v7.3 Greedy Edition)
    const extractFromPositionalArray = (arr: any[]): any[] => {
        const results: any[] = [];
        if (!Array.isArray(arr) || arr.length < 5) return results;

        const hasMatchIndicator = arr.some(v => typeof v === 'string' && (v.includes(' vs ') || v.length > 5 && !/^\d+(\.\d+)?$/.test(v)));
        if (!hasMatchIndicator && arr.length < 20 && !matchCache.has(String(arr[0]))) return results;

        if (arr.length < 20) {
            const potentialMatchId = String(arr[0] || '');
            if (potentialMatchId && matchCache.has(potentialMatchId)) {
                const cached = matchCache.get(potentialMatchId)!;
                const numbers = arr.filter(v => typeof v === 'number' && v !== 0);
                if (numbers.length >= 2) {
                    try { fs.appendFileSync(wireLog, `[${new Date().toISOString()}] [SHORT-UPDATE] MatchId=${potentialMatchId} Teams=${cached.home} vs ${cached.away} nums=${numbers.length}\n`); } catch (e) { }
                    results.push({ matchId: potentialMatchId, ...cached, selection: 'Home', odds: numbers[0], market: 'HDP', _parsedBy: 'short_v8.6' });
                    results.push({ matchId: potentialMatchId, ...cached, selection: 'Away', odds: numbers[1], market: 'HDP', _parsedBy: 'short_v8.6' });
                }
            }
            return results;
        }

        let hIdx = -1, aIdx = -1;
        const isJunkTeam = (s: string) => {
            if (!s) return true;
            const clean = s.replace(/<[^>]*>/g, '').trim().toLowerCase();
            if (clean.length < 2) return true;
            if (/^\d{1,2}[\/:]\d{1,2}/.test(clean) || clean.includes('am') || clean.includes('pm') || clean.includes("'")) return true;
            if (/^\d{1,2}\s*-\s*\d{1,2}$/.test(clean)) return true;
            const exactLabels = ['1h', '2h', 'ht', 'ft', 'live', 'all', 'closed'];
            const partialLabels = ['half time', 'today', 'early', 'streaming', 'postponed', 'waiting'];
            if (exactLabels.includes(clean)) return true;
            if (partialLabels.some(l => clean.includes(l))) return true;
            return false;
        };

        for (let i = 5; i < Math.min(arr.length, 30); i++) {
            const val = arr[i];
            if (typeof val === 'string' && val.length > 2) {
                if (isJunkTeam(val)) continue;
                if (hIdx === -1) hIdx = i;
                else if (aIdx === -1 && i > hIdx) {
                    aIdx = i;
                    break;
                }
            }
        }

        if (hIdx !== -1 && aIdx !== -1) {
            const home = String(arr[hIdx]).replace(/<[^>]*>/g, '').trim();
            const away = String(arr[aIdx]).replace(/<[^>]*>/g, '').trim();
            let matchId = String(arr[0] || '');

            // 🎯 v8.5 [STRICT]: Deterministic Identity replacement for positional junk IDs
            if (!matchId || parseFloat(matchId) < 1000) {
                // 🛡️ v8.5 [STRICT]: Deterministic Identity ONLY.
                // ADR-005: Fallbacks are forbidden. Fail-fast if fingerprinting fails.
                matchId = EventIdentity.generateFingerprint('soccer', '0000-00-00T00:00:00.000Z', home, away);
            }

            if (matchCache.size >= MATCH_CACHE_MAX) {
                const firstKey = matchCache.keys().next().value;
                if (firstKey) matchCache.delete(firstKey);
            }
            matchCache.set(matchId, { home, away, league: 'Saba-Greedy' });

            const baseMatch = {
                matchId,
                home,
                away,
                league: 'Saba-Greedy',
                _parsedBy: 'greedy_v8.5_deterministic'
            };

            const potentialOdds: number[] = [];
            const potentialLines: number[] = [];

            for (let i = 0; i < arr.length; i++) {
                const val = arr[i];
                if (typeof val === 'number' && val !== 0) {
                    if (Math.abs(val) > 1.01 && Math.abs(val) < 50) potentialOdds.push(val);
                    else if (Math.abs(val) < 10) potentialLines.push(val);
                }
            }

            if (potentialOdds.length >= 2) {
                const capturedMatches = (home + ' vs ' + away).substring(0, 50);
                try { fs.appendFileSync(wireLog, `[${new Date().toISOString()}] [GREEDY-DETECT] ${capturedMatches} OddsCount=${potentialOdds.length}\n`); } catch (e) { }
                results.push({ ...baseMatch, selection: 'Home', odds: potentialOdds[0], market: 'HDP', line: String(potentialLines[0] || '0') });
                results.push({ ...baseMatch, selection: 'Away', odds: potentialOdds[1], market: 'HDP', line: String(potentialLines[0] || '0') });
            } else {
                results.push(baseMatch);
            }
        } else {
            const potentialMatchId = arr[0];
            if (typeof potentialMatchId === 'number' && matchCache.has(String(potentialMatchId))) {
                const cached = matchCache.get(String(potentialMatchId))!;
                const potentialOdds: number[] = [];
                for (let i = 1; i < arr.length; i++) {
                    const val = arr[i];
                    if (typeof val === 'number' && Math.abs(val) > 1.01 && Math.abs(val) < 50) {
                        potentialOdds.push(val);
                    }
                }
                if (potentialOdds.length >= 2) {
                    try { fs.appendFileSync(wireLog, `[${new Date().toISOString()}] [CACHE-HIT] MatchId=${potentialMatchId} ${cached.home} vs ${cached.away}\n`); } catch (e) { }
                    results.push({ matchId: String(potentialMatchId), ...cached, selection: 'Home', odds: potentialOdds[0], market: 'HDP', _parsedBy: 'cache_v7.4' });
                    results.push({ matchId: String(potentialMatchId), ...cached, selection: 'Away', odds: potentialOdds[1], market: 'HDP', _parsedBy: 'cache_v7.4' });
                }
            }
        }
        return results;
    };

    const extractMatches = (target: any, depth = 0): any[] => {
        const results: any[] = [];
        if (depth > 12 || !target) return results;

        if (Array.isArray(target)) {
            const fromPos = extractFromPositionalArray(target);
            if (fromPos.length > 0) results.push(...fromPos);
            for (const item of target) {
                if (typeof item === 'object') results.push(...extractMatches(item, depth + 1));
            }
            return results;
        }

        if (typeof target !== 'object') return results;

        const keys = Object.keys(target);
        const keyStr = keys.join(',').toLowerCase();

        const hasHomeKey = HOME_PATTERNS.test(keyStr);
        const hasAwayKey = AWAY_PATTERNS.test(keyStr);

        if (hasHomeKey || hasAwayKey) {
            let home = '', away = '', matchId = '', league = 'Fuzzy', scheduledTime = '';

            // AFB Specific Date/Time Concatenation
            const mDate = target.MatchDate || target.match_date || target.matchdate || '';
            const mTime = target.MatchTime || target.match_time || target.matchtime || '';
            if (mDate && mTime) {
                scheduledTime = `${mDate.replace(/\//g, '-')}T${mTime}:00.000Z`;
            } else if (mDate || mTime) {
                scheduledTime = mDate || mTime;
            }

            for (const k of keys) {
                const val = target[k];
                if (HOME_PATTERNS.test(k) && typeof val === 'string' && val.length > 1) home = val.replace(/<[^>]*>/g, '').trim();
                else if (AWAY_PATTERNS.test(k) && typeof val === 'string' && val.length > 1) away = val.replace(/<[^>]*>/g, '').trim();
                else if (MATCH_PATTERNS.test(k) && val && typeof val !== 'object') matchId = String(val);
                else if (LEAGUE_PATTERNS.test(k) && typeof val === 'string') league = val.replace(/<[^>]*>/g, '').trim();
            }

            if (home || away) {
                // 🎯 v8.5 [STRICT]: Deterministic Identity replacement for object-based junk IDs
                if (!matchId || matchId.length < 5) {
                    // 🛡️ v8.5 [STRICT]: Deterministic Identity ONLY.
                    // ADR-005: Fallbacks are forbidden. Fail-fast if fingerprinting fails.
                    const canonicalTime = scheduledTime || '0000-00-00T00:00:00.000Z';
                    matchId = EventIdentity.generateFingerprint('soccer', canonicalTime, home, away);
                }

                const entry = { matchId, home, away, league, ...target, _parsedBy: 'fuzzy_v8.5_deterministic' };

                const hp = target.HomePrice || target.hp || target.homeprice || target.h_price || target.hdp_h || target.o1;
                const ap = target.AwayPrice || target.ap || target.awayprice || target.a_price || target.hdp_a || target.o2;
                const op = target.OverPrice || target.op || target.overprice || target.ou_o || target.ov;
                const up = target.UnderPrice || target.up || target.underprice || target.ou_u || target.un;

                if (hp !== undefined) results.push({ ...entry, selection: 'Home', odds: hp, market: 'FT_HDP' });
                if (ap !== undefined) results.push({ ...entry, selection: 'Away', odds: ap, market: 'FT_HDP' });
                if (op !== undefined) results.push({ ...entry, selection: 'Over', odds: op, market: 'FT_OU' });
                if (up !== undefined) results.push({ ...entry, selection: 'Under', odds: up, market: 'FT_OU' });

                // 🛡️ v8.8: FALLBACK for scraper-generated 'odds' array
                if (results.length === 0 && Array.isArray(target.odds) && target.odds.length >= 2) {
                    results.push({ ...entry, selection: 'Home', odds: target.odds[0], market: 'FT_HDP' });
                    results.push({ ...entry, selection: 'Away', odds: target.odds[1], market: 'FT_HDP' });
                }

                if (results.length === 0) results.push(entry);
            }
        }

        for (const key of keys) {
            const val = target[key];
            if (val && typeof val === 'object') {
                results.push(...extractMatches(val, depth + 1));
            }
        }

        return results;
    };

    try {
        odds = extractMatches(obj);
        balance = extractBalance(obj);
        if (balance === null && odds.length > 0) {
            for (const item of odds) {
                const itemBalance = extractBalance(item);
                if (itemBalance !== null) { balance = itemBalance; break; }
            }
        }
    } catch (e) {
        console.error(`[AFB-PARSE-ERR] ${e.message}`);
    }

    return { odds, balance };
}

// 🛡️ v7.5: Extract data from malformed JSON strings
function extractFromMalformedJson(rawString: string): { odds: any[], balance: number | null } {
    const odds: any[] = [];
    let balance: number | null = null;

    try {
        // Try to extract balance from db array
        const dbMatch = rawString.match(/"db"\s*:\s*\[([^\]]*)\]/);
        if (dbMatch) {
            const dbContent = dbMatch[1];
            const balanceMatch = dbContent.match(/"balance"\s*:\s*"([^"]+)"/) || dbContent.match(/"Balance"\s*:\s*([0-9.]+)/);
            if (balanceMatch) {
                balance = parseFloat(balanceMatch[1].replace(/[^0-9.]/g, ''));
            }
        }

        // Try to extract matches from various patterns
        // Look for HomeName/AwayName patterns
        const matchRegex = /"HomeName"\s*:\s*"([^"]+)"\s*,\s*"AwayName"\s*:\s*"([^"]+)"/g;
        let match;
        while ((match = matchRegex.exec(rawString)) !== null) {
            const home = match[1];
            const away = match[2];
            
            // Try to find odds nearby
            const startPos = match.index;
            const endPos = Math.min(startPos + 1000, rawString.length);
            const nearby = rawString.substring(startPos, endPos);
            
            const homePriceMatch = nearby.match(/"HomePrice"\s*:\s*([0-9.]+)/);
            const awayPriceMatch = nearby.match(/"AwayPrice"\s*:\s*([0-9.]+)/);
            
            if (homePriceMatch || awayPriceMatch) {
                const matchId = EventIdentity.generateFingerprint('soccer', new Date().toISOString(), home, away);
                if (homePriceMatch) {
                    odds.push({
                        matchId,
                        home,
                        away,
                        selection: 'Home',
                        odds: parseFloat(homePriceMatch[1]),
                        market: 'HDP'
                    });
                }
                if (awayPriceMatch) {
                    odds.push({
                        matchId,
                        home,
                        away,
                        selection: 'Away', 
                        odds: parseFloat(awayPriceMatch[1]),
                        market: 'HDP'
                    });
                }
            }
        }

        console.log(`[MALFORMED-EXTRACT] Extracted ${odds.length} odds and balance: ${balance}`);
    } catch (e) {
        console.error(`[MALFORMED-EXTRACT-ERR] ${e.message}`);
    }

    return { odds, balance };
}
