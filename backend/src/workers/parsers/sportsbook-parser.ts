import * as fs from 'fs';
import * as path from 'path';
import { EventIdentity } from '../../utils/identity.utils';

// 🛡️ v6.2 UNIVERSAL FUZZY PARSER (DPI SHELL)
// Optimized for ISPORT/SABA whitelabels

// FUZZY KEY PATTERNS (🛡️ v8.8: Added anchors to prevent multi-match with e.g. LeagueName)
const HOME_PATTERNS = /^(home|h_?name|hteam|team.?a|team.?1|ht|local|host|htnm|htname)$/i;
const AWAY_PATTERNS = /^(away|a_?name|ateam|team.?b|team.?2|at|visitor|guest|atnm|atname)$/i;
const ODDS_PATTERNS = /^(odds|price|rate|value|hdp|ou|line|over|under|decimal)$/i;
const MATCH_PATTERNS = /^(match|event|game|fixture|id|mid|matchid|eventid)$/i;
const LEAGUE_PATTERNS = /^(league|comp|tournament|division|group|lgnm|leaguename)$/i;
const TIME_PATTERNS = /^(matchtime|kickofftime|starttime|time|matchdate|eventtime|kickoff)$/i;

export function parseSportsbookPacket(obj: any): { odds: any[], balance: number | null } {
    let odds: any[] = [];
    let balance: number | null = null;
    const wireLog = path.join(process.cwd(), 'logs', 'wire_debug.log');

    if (!obj) return { odds, balance };

    // 🎯 BALANCE EXTRACTION
    const extractBalance = (target: any): number | null => {
        if (!target || typeof target !== 'object') return null;

        const balanceKeys = ['balance', 'Balance', 'credit', 'Credit',
            'availableBalance', 'AvailableBalance', 'cash', 'Cash',
            'bal', 'Bal', 'available', 'Available', 'Amount', 'amount',
            'uBal', 'ubal', 'ba', 'Ba', 'BA', 'Balance2D', 'Balance2',
            'currentBalance', 'CurrentBalance', 'totalBalance', 'TotalBalance',
            'availBal', 'AvailBal', 'memberBal', 'MemberBal'];
        for (const key of balanceKeys) {
            if (target[key] !== undefined && target[key] !== null && typeof target[key] !== 'object') {
                const val = parseFloat(String(target[key]).replace(/[^0-9.]/g, ''));
                if (!isNaN(val)) return val;
            }
        }

        // 🛡️ v7.1: Deep search in common wrapper objects
        const wrappers = ['account', 'user', 'db', 'data', 'result', 'response', 'js', 'member', 'info'];
        for (const w of wrappers) {
            if (target[w]) {
                if (Array.isArray(target[w])) {
                    // Scan array elements for balance
                    for (const item of target[w]) {
                        if (item && typeof item === 'object') {
                            const found = extractBalance(item);
                            if (found !== null) return found;
                        }
                    }
                } else if (typeof target[w] === 'object') {
                    const found = extractBalance(target[w]);
                    if (found !== null) return found;
                }
            }
        }

        // 🛡️ Parse cookies for balance (ISPORT style)
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

    // 🎯 EXTRACT ALL MATCHES FROM ANY STRUCTURE
    const extractMatches = (target: any, depth = 0): any[] => {
        const results: any[] = [];
        if (depth > 8 || !target || typeof target !== 'object') return results;

        // 🛡️ v9.9: Handle pre-parsed "matches" array structure from extension
        if (target.matches && Array.isArray(target.matches)) {
            console.log(`[SPORTSBOOK-PARSER] 🎯 Found pre-parsed matches array with ${target.matches.length} items`);
            for (const match of target.matches) {
                // Extension already parsed this - just pass through with normalization
                if (match.home || match.homeTeam || match.HomeName) {
                    const home = match.home || match.homeTeam || match.HomeName || '';
                    const away = match.away || match.awayTeam || match.AwayName || '';
                    const matchId = match.matchId || match.id || match.eventId || `${home}_${away}`.toUpperCase();
                    
                    results.push({
                        matchId,
                        home,
                        away,
                        homeTeam: home,
                        awayTeam: away,
                        HomeName: home,
                        AwayName: away,
                        league: match.league || match.leagueName || 'Unknown',
                        ...match,
                        _parsedBy: 'sportsbook_matches_array_v9.9'
                    });
                }
            }
            return results;
        }

        if (Array.isArray(target)) {
            for (const item of target) {
                results.push(...extractMatches(item, depth + 1));
            }
            return results;
        }

        // Try to extract match data from this object
        const keys = Object.keys(target);

        // 🛡️ v9.9 FIX: Test each key individually, not the joined string
        let hasHomeKey = false;
        let hasAwayKey = false;
        for (const k of keys) {
            if (HOME_PATTERNS.test(k)) hasHomeKey = true;
            if (AWAY_PATTERNS.test(k)) hasAwayKey = true;
        }

        if (hasHomeKey || hasAwayKey) {
            // Extract attributes from this object
            let home = '';
            let away = '';
            let matchId = '';
            let league = 'Unknown';
            let scheduledTime = '';

            for (const k of keys) {
                const val = target[k];
                if (HOME_PATTERNS.test(k) && typeof val === 'string' && val.length > 1) {
                    home = val.replace(/<[^>]*>/g, '').trim();
                } else if (AWAY_PATTERNS.test(k) && typeof val === 'string' && val.length > 1) {
                    away = val.replace(/<[^>]*>/g, '').trim();
                } else if (MATCH_PATTERNS.test(k) && val && typeof val !== 'object') {
                    matchId = String(val);
                } else if (LEAGUE_PATTERNS.test(k) && typeof val === 'string') {
                    league = val.replace(/<[^>]*>/g, '').trim();
                } else if (TIME_PATTERNS.test(k) && val) {
                    if (typeof val === 'number') {
                        scheduledTime = new Date(val).toISOString();
                    } else if (typeof val === 'string' && val.length > 5) {
                        scheduledTime = val;
                    }
                }
            }

            // 🎯 v8.5 [STRICT]: Fallback time if missing
            if (!scheduledTime) {
                scheduledTime = '0000-00-00T00:00:00.000Z';
            }

            // 🛡️ v8.9: HEURISTIC VALIDITY CHECK (Relaxed for Fail-Open strategy)
            const isLabel = (s: string) => {
                const low = s.toLowerCase().trim();
                const exactLabels = ['soccer', 'basketball', 'tennis', 'volleyball', 'badminton', 'baseball', 'cricket', 'rugby', 'darts', 'early', 'today', 'live'];
                const junkKeywords = [
                    'english', 'bahasa', 'indonesia', 'vietnam', 'thailand', 'khmer', 'login', 'logout',
                    'balance', 'credit', 'account', 'deposit', 'withdraw', 'all markets',
                    'filter match', 'leagues', 'sports', 'favorites', 'search'
                ];

                // Allow "Soccer" if it's part of a longer name (e.g. "Soccer Club")
                if (exactLabels.includes(low)) return true;
                return junkKeywords.some(k => low === k || (low.includes(k) && low.length < k.length + 3));
            };

            // If we found at least one team name, create entry
            // 🛡️ v8.9: FAIL-OPEN - Accept even short names if they aren't explicit labels
            if ((home && home.length >= 2 && !isLabel(home)) || (away && away.length >= 2 && !isLabel(away))) {

                // 🎯 v8.5 [FIX]: Replace random ID with Deterministic Canonical Fingerprint
                if (!matchId || matchId.length < 5) {
                    try {
                        matchId = EventIdentity.generateFingerprint('soccer', scheduledTime, home, away);
                    } catch (e) {
                        matchId = `ERR_${EventIdentity.normalize(home)}_${EventIdentity.normalize(away)}`.toUpperCase();
                    }
                }

                const entry = {
                    matchId,
                    home,
                    away,
                    homeTeam: home, // 🛡️ UI Alias
                    awayTeam: away, // 🛡️ UI Alias
                    HomeName: home,
                    AwayName: away,
                    league,
                    ...target,
                    _parsedBy: 'sportsbook_fuzzy_v8.5'
                };


                // Create odds entries if we have price data
                const hp = target.HomePrice || target.hp || target.homeprice || target.h_price || target.hdp_h || target.o1;
                const ap = target.AwayPrice || target.ap || target.awayprice || target.a_price || target.hdp_a || target.o2;
                const op = target.OverPrice || target.op || target.overprice || target.ou_o || target.ov;
                const up = target.UnderPrice || target.up || target.underprice || target.ou_u || target.un;

                if (hp !== undefined || ap !== undefined) {
                    if (hp !== undefined) results.push({ ...entry, selection: 'Home', odds: parseFloat(String(hp)) || 0, oddsVal: parseFloat(String(hp)) || 0, market: 'HDP' });
                    if (ap !== undefined) results.push({ ...entry, selection: 'Away', odds: parseFloat(String(ap)) || 0, oddsVal: parseFloat(String(ap)) || 0, market: 'HDP' });
                }

                if (op !== undefined || up !== undefined) {
                    if (op !== undefined) results.push({ ...entry, selection: 'Over', odds: parseFloat(String(op)) || 0, oddsVal: parseFloat(String(op)) || 0, market: 'OU' });
                    if (up !== undefined) results.push({ ...entry, selection: 'Under', odds: parseFloat(String(up)) || 0, oddsVal: parseFloat(String(up)) || 0, market: 'OU' });
                }


                if (results.length === 0) {
                    results.push(entry);
                }
            }
        }

        // Recurse into all object properties
        for (const key of keys) {
            const val = target[key];
            if (val && typeof val === 'object') {
                results.push(...extractMatches(val, depth + 1));
            }
        }

        return results;
    };

    // 🔥 EXECUTE EXTRACTION
    try {
        odds = extractMatches(obj);
        balance = extractBalance(obj);

        if (odds.length > 0 || balance !== null) {
            const msg = `[SPORTSBOOK-PARSE-RESULT] ✅ Extracted ${odds.length} matches, Balance=${balance}`;
            console.log(msg);
            try { fs.appendFileSync(wireLog, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
        }
    } catch (e) {
        console.error(`[SPORTSBOOK-PARSE-ERR] ${e.message}`);
    }

    return { odds, balance };
}
