/**
 * SABA/ISPORT PARSER
 * ===================
 * Parse raw payload dari SABA menjadi normalized odds.
 * 
 * SABA data characteristics:
 * - Nested JSON structure
 * - Team names in: htnm, atnm, HomeName, AwayName
 * - Odds in various formats depending on market type
 * 
 * Jika SABA update format, edit file INI saja.
 */

import { ParseResult, ParsedOdds } from '../base.provider';
import { SABA_CONFIG } from './saba.config';

// Key patterns untuk fuzzy matching
const HOME_KEYS = /^(home|h_?name|hteam|team.?a|team.?1|ht|htnm|htname|homename)$/i;
const AWAY_KEYS = /^(away|a_?name|ateam|team.?b|team.?2|at|atnm|atname|awayname)$/i;
const MATCH_ID_KEYS = /^(match|event|game|fixture|id|mid|matchid|eventid)$/i;
const LEAGUE_KEYS = /^(league|comp|tournament|division|group|lgnm|leaguename)$/i;
const TIME_KEYS = /^(matchtime|kickofftime|starttime|time|matchdate|eventtime|kickoff)$/i;

/**
 * Main parser function untuk SABA
 */
export function parseSabaPayload(data: any): ParseResult {
    const result: ParseResult = {
        odds: [],
        balance: null,
        rawMatchCount: 0,
    };
    
    if (!data) return result;
    
    try {
        // Extract balance
        result.balance = extractBalance(data);
        
        // Extract matches and odds
        const matches = extractMatches(data);
        result.odds = matches;
        result.rawMatchCount = new Set(matches.map(m => m.matchId)).size;
        
    } catch (e) {
        console.error(`[SABA-PARSER] Error: ${(e as Error).message}`);
    }
    
    return result;
}

/**
 * Extract balance from SABA response
 */
function extractBalance(target: any, depth = 0): number | null {
    if (!target || typeof target !== 'object' || depth > 5) return null;
    
    // Direct key search
    for (const key of SABA_CONFIG.balanceKeys) {
        if (target[key] !== undefined && target[key] !== null && typeof target[key] !== 'object') {
            const val = parseFloat(String(target[key]).replace(/[^0-9.-]/g, ''));
            if (!isNaN(val) && val >= 0) return val;
        }
    }
    
    // Search in common wrappers
    const wrappers = ['account', 'user', 'db', 'data', 'result', 'response', 'js', 'member', 'info'];
    for (const w of wrappers) {
        if (target[w] && typeof target[w] === 'object' && !Array.isArray(target[w])) {
            const found = extractBalance(target[w], depth + 1);
            if (found !== null) return found;
        }
    }
    
    return null;
}

/**
 * Recursive match extractor
 */
function extractMatches(target: any, depth = 0): ParsedOdds[] {
    const results: ParsedOdds[] = [];
    if (depth > 8 || !target || typeof target !== 'object') return results;
    
    if (Array.isArray(target)) {
        // Check if positional array (SABA sometimes sends data this way)
        const fromPositional = extractFromPositionalArray(target);
        if (fromPositional.length > 0) {
            results.push(...fromPositional);
        }
        
        // Recurse into array items
        for (const item of target) {
            results.push(...extractMatches(item, depth + 1));
        }
        return results;
    }
    
    // Object processing
    const keys = Object.keys(target);
    const keyStr = keys.join(',').toLowerCase();
    
    // Check if this object has team data
    const hasHomeKey = keys.some(k => HOME_KEYS.test(k));
    const hasAwayKey = keys.some(k => AWAY_KEYS.test(k));
    
    if (hasHomeKey || hasAwayKey) {
        const matchData = extractMatchFromObject(target, keys);
        if (matchData) {
            results.push(...matchData);
        }
    }
    
    // Recurse into nested objects
    for (const key of keys) {
        const val = target[key];
        if (val && typeof val === 'object') {
            results.push(...extractMatches(val, depth + 1));
        }
    }
    
    return results;
}

/**
 * Extract match data from a single object
 */
function extractMatchFromObject(obj: any, keys: string[]): ParsedOdds[] | null {
    let home = '';
    let away = '';
    let matchId = '';
    let league = 'Unknown';
    let scheduledTime = '';
    
    for (const k of keys) {
        const val = obj[k];
        if (HOME_KEYS.test(k) && typeof val === 'string' && val.length > 1) {
            home = cleanTeamName(val);
        } else if (AWAY_KEYS.test(k) && typeof val === 'string' && val.length > 1) {
            away = cleanTeamName(val);
        } else if (MATCH_ID_KEYS.test(k) && val && typeof val !== 'object') {
            matchId = String(val);
        } else if (LEAGUE_KEYS.test(k) && typeof val === 'string') {
            league = cleanTeamName(val);
        } else if (TIME_KEYS.test(k) && val) {
            scheduledTime = parseTime(val);
        }
    }
    
    // Validation
    if (!home && !away) return null;
    if (isLabelOrJunk(home) && isLabelOrJunk(away)) return null;
    
    // Generate matchId if not found
    if (!matchId || matchId.length < 3) {
        matchId = generateMatchId(home, away, scheduledTime);
    }
    
    const results: ParsedOdds[] = [];
    const baseEntry = {
        matchId,
        home: home || 'TBD',
        away: away || 'TBD',
        league,
        provider: 'SABA',
        scheduledTime,
        parsedAt: Date.now(),
    };
    
    // Extract odds from various possible keys
    const hp = obj.HomePrice || obj.hp || obj.homeprice || obj.h_price || obj.hdp_h || obj.o1;
    const ap = obj.AwayPrice || obj.ap || obj.awayprice || obj.a_price || obj.hdp_a || obj.o2;
    const op = obj.OverPrice || obj.op || obj.overprice || obj.ou_o || obj.ov;
    const up = obj.UnderPrice || obj.up || obj.underprice || obj.ou_u || obj.un;
    const line = obj.Line || obj.line || obj.hdp || obj.Hdp || obj.HDP || '';
    
    if (hp !== undefined) {
        results.push({ ...baseEntry, market: 'HDP', selection: 'Home', odds: parseFloat(String(hp)) || 0, line: String(line) });
    }
    if (ap !== undefined) {
        results.push({ ...baseEntry, market: 'HDP', selection: 'Away', odds: parseFloat(String(ap)) || 0, line: String(line) });
    }
    if (op !== undefined) {
        results.push({ ...baseEntry, market: 'OU', selection: 'Over', odds: parseFloat(String(op)) || 0, line: String(line) });
    }
    if (up !== undefined) {
        results.push({ ...baseEntry, market: 'OU', selection: 'Under', odds: parseFloat(String(up)) || 0, line: String(line) });
    }
    
    // If no explicit odds but has team data, still record the match
    if (results.length === 0) {
        results.push({ ...baseEntry, market: 'HDP', selection: 'Unknown', odds: 0 });
    }
    
    return results;
}

/**
 * Extract from positional array (SABA sometimes uses index-based data)
 */
function extractFromPositionalArray(arr: any[]): ParsedOdds[] {
    if (!Array.isArray(arr) || arr.length < 10) return [];
    
    const results: ParsedOdds[] = [];
    
    // Find string elements that look like team names
    let homeIdx = -1, awayIdx = -1;
    
    for (let i = 5; i < Math.min(arr.length, 30); i++) {
        const val = arr[i];
        if (typeof val === 'string' && val.length > 2 && !isLabelOrJunk(val)) {
            if (homeIdx === -1) {
                homeIdx = i;
            } else if (awayIdx === -1 && i > homeIdx) {
                awayIdx = i;
                break;
            }
        }
    }
    
    if (homeIdx !== -1 && awayIdx !== -1) {
        const home = cleanTeamName(String(arr[homeIdx]));
        const away = cleanTeamName(String(arr[awayIdx]));
        const matchId = arr[0] ? String(arr[0]) : generateMatchId(home, away, '');
        
        // Find numeric values for odds
        const numbers: number[] = [];
        for (const val of arr) {
            if (typeof val === 'number' && Math.abs(val) > 1.01 && Math.abs(val) < 50) {
                numbers.push(val);
            }
        }
        
        if (numbers.length >= 2) {
            results.push({
                matchId,
                home,
                away,
                league: 'SABA-Array',
                market: 'HDP',
                selection: 'Home',
                odds: numbers[0],
                provider: 'SABA',
                parsedAt: Date.now(),
            });
            results.push({
                matchId,
                home,
                away,
                league: 'SABA-Array',
                market: 'HDP',
                selection: 'Away',
                odds: numbers[1],
                provider: 'SABA',
                parsedAt: Date.now(),
            });
        }
    }
    
    return results;
}

// ============ HELPER FUNCTIONS ============

function cleanTeamName(name: string): string {
    return name.replace(/<[^>]*>/g, '').trim();
}

function parseTime(val: any): string {
    if (typeof val === 'number') {
        return new Date(val).toISOString();
    }
    if (typeof val === 'string' && val.length > 5) {
        return val;
    }
    return '';
}

function isLabelOrJunk(s: string): boolean {
    if (!s) return true;
    const low = s.toLowerCase().trim();
    if (low.length < 2) return true;
    
    const exactLabels = ['soccer', 'basketball', 'tennis', 'volleyball', 'badminton', 
        'baseball', 'cricket', 'rugby', 'darts', 'early', 'today', 'live', '1h', '2h', 'ht', 'ft'];
    const junkKeywords = ['english', 'bahasa', 'indonesia', 'vietnam', 'thailand', 'login', 
        'logout', 'balance', 'credit', 'account', 'deposit', 'withdraw', 'all markets',
        'filter match', 'leagues', 'sports', 'favorites', 'search', 'streaming'];
    
    if (exactLabels.includes(low)) return true;
    return junkKeywords.some(k => low.includes(k));
}

function generateMatchId(home: string, away: string, time: string): string {
    const h = home.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
    const a = away.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
    const t = time ? time.substring(0, 10).replace(/[^0-9]/g, '') : Date.now().toString().substring(5, 10);
    return `SABA_${h}_${a}_${t}`;
}
