/**
 * AFB88 PARSER
 * =============
 * Parse raw payload dari AFB88 menjadi normalized odds.
 * 
 * AFB88 data characteristics:
 * - Can be GZIP compressed (H4s... prefix)
 * - Positional array format common
 * - WebSocket frames for real-time updates
 * 
 * Jika AFB88 update format, edit file INI saja.
 */

import { ParseResult, ParsedOdds } from '../base.provider';
import { AFB88_CONFIG, isGzipPayload } from './afb88.config';
import * as zlib from 'zlib';

// Maximum entries kept in per-call match cache
const MATCH_CACHE_MAX = 500;

// Key patterns
const HOME_KEYS = /^(home|h_?name|hteam|team.?a|team.?1|ht|htnm)$/i;
const AWAY_KEYS = /^(away|a_?name|ateam|team.?b|team.?2|at|atnm)$/i;
const MATCH_ID_KEYS = /^(match|event|game|fixture|id|mid)$/i;
const LEAGUE_KEYS = /^(league|comp|tournament|division|group|lgnm)$/i;

// NOTE: module-level matchCache removed to avoid shared mutable state.
// A per-call cache is threaded through parser helpers from `parseAfb88Payload`.

/**
 * Main parser function untuk AFB88
 */
export function parseAfb88Payload(data: any): ParseResult {
    // Per-call match cache to avoid global mutable state
    const matchCache: Map<string, { home: string; away: string; league?: string }> = new Map();
    const MATCH_CACHE_MAX = 500;
    const result: ParseResult = {
        odds: [],
        balance: null,
        rawMatchCount: 0,
    };
    
    if (!data) return result;
    
    try {
        // Handle GZIP compressed data
        let payload = data;
        if (isGzipPayload(data)) {
            payload = decompressGzip(data);
            if (!payload) return result;
        }
        
        // Extract balance
        result.balance = extractBalance(payload);
        
        // Extract matches and odds
        const matches = extractMatches(payload, 0, matchCache);
        result.odds = matches;
        result.rawMatchCount = new Set(matches.map(m => m.matchId)).size;
        
    } catch (e) {
        console.error(`[AFB88-PARSER] Error: ${(e as Error).message}`);
    }
    
    return result;
}

/**
 * Decompress GZIP payload (Base64 encoded)
 */
function decompressGzip(data: string): any {
    try {
        const buffer = Buffer.from(data, 'base64');
        const decompressed = zlib.gunzipSync(buffer);
        return JSON.parse(decompressed.toString('utf-8'));
    } catch (e) {
        console.error(`[AFB88-GZIP] Decompression failed: ${(e as Error).message}`);
        return null;
    }
}

/**
 * Extract balance
 */
function extractBalance(target: any, depth = 0): number | null {
    if (!target || typeof target !== 'object' || depth > 5) return null;
    
    for (const key of AFB88_CONFIG.balanceKeys) {
        if (target[key] !== undefined && target[key] !== null && typeof target[key] !== 'object') {
            const val = parseFloat(String(target[key]).replace(/[^0-9.-]/g, ''));
            if (!isNaN(val) && val >= 0) return val;
        }
    }
    
    // Search wrappers
    const wrappers = ['db', 'user', 'data', 'account', 'js', 'result', 'response'];
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
function extractMatches(target: any, depth = 0, matchCache?: Map<string, { home: string; away: string; league?: string }>): ParsedOdds[] {
    const results: ParsedOdds[] = [];
    if (depth > 12 || !target) return results;
    
    if (Array.isArray(target)) {
        // AFB88 often uses positional arrays
        const fromPositional = extractFromPositionalArray(target, matchCache);
        if (fromPositional.length > 0) {
            results.push(...fromPositional);
        }
        
        for (const item of target) {
            if (typeof item === 'object') {
                results.push(...extractMatches(item, depth + 1, matchCache));
            }
        }
        return results;
    }
    
    if (typeof target !== 'object') return results;
    
    const keys = Object.keys(target);
    
    // Check for team data
    const hasHomeKey = keys.some(k => HOME_KEYS.test(k));
    const hasAwayKey = keys.some(k => AWAY_KEYS.test(k));
    
    if (hasHomeKey || hasAwayKey) {
        const matchData = extractMatchFromObject(target, keys, matchCache);
        if (matchData) {
            results.push(...matchData);
        }
    }
    
    // Recurse
    for (const key of keys) {
        const val = target[key];
        if (val && typeof val === 'object') {
            results.push(...extractMatches(val, depth + 1, matchCache));
        }
    }
    
    return results;
}

/**
 * Extract match from object
 */
function extractMatchFromObject(obj: any, keys: string[], matchCache?: Map<string, { home: string; away: string; league?: string }>): ParsedOdds[] | null {
    let home = '';
    let away = '';
    let matchId = '';
    let league = 'AFB88-Fuzzy';
    let scheduledTime = '';
    
    // AFB88 specific: Date + Time concatenation
    const mDate = obj.MatchDate || obj.match_date || obj.matchdate || '';
    const mTime = obj.MatchTime || obj.match_time || obj.matchtime || '';
    if (mDate && mTime) {
        scheduledTime = `${mDate.replace(/\//g, '-')}T${mTime}:00.000Z`;
    }
    
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
        }
    }
    
    if (!home && !away) return null;
    if (isJunkTeam(home) && isJunkTeam(away)) return null;
    
    // Generate matchId if needed
    if (!matchId || matchId.length < 5) {
        matchId = generateMatchId(home, away, scheduledTime);
    }
    
    // Cache for short updates
    if (matchCache) {
        if (matchCache.size >= MATCH_CACHE_MAX) {
            const firstKey = matchCache.keys().next().value;
            if (firstKey) matchCache.delete(firstKey);
        }
        matchCache.set(matchId, { home, away, league });
    }
    
    const results: ParsedOdds[] = [];
    const baseEntry = {
        matchId,
        home: home || 'TBD',
        away: away || 'TBD',
        league,
        provider: 'AFB88',
        scheduledTime,
        parsedAt: Date.now(),
    };
    
    // Extract odds
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
    
    if (results.length === 0) {
        results.push({ ...baseEntry, market: 'HDP', selection: 'Unknown', odds: 0 });
    }
    
    return results;
}

/**
 * Extract from positional array (AFB88 common format)
 */
function extractFromPositionalArray(arr: any[], matchCache?: Map<string, { home: string; away: string; league?: string }>): ParsedOdds[] {
    if (!Array.isArray(arr) || arr.length < 5) return [];
    
    const results: ParsedOdds[] = [];
    
    // Check for short update (cached matchId)
    const potentialMatchId = String(arr[0] || '');
    if (arr.length < 20 && matchCache && matchCache.has(potentialMatchId)) {
        const cached = matchCache.get(potentialMatchId)!;
        const numbers: number[] = [];
        
        for (const val of arr) {
            if (typeof val === 'number' && Math.abs(val) > 1.01 && Math.abs(val) < 50) {
                numbers.push(val);
            }
        }
        
        if (numbers.length >= 2) {
            results.push({
                matchId: potentialMatchId,
                home: cached.home,
                away: cached.away,
                league: cached.league || 'AFB88-Cache',
                market: 'HDP',
                selection: 'Home',
                odds: numbers[0],
                provider: 'AFB88',
                parsedAt: Date.now(),
            });
            results.push({
                matchId: potentialMatchId,
                home: cached.home,
                away: cached.away,
                league: cached.league || 'AFB88-Cache',
                market: 'HDP',
                selection: 'Away',
                odds: numbers[1],
                provider: 'AFB88',
                parsedAt: Date.now(),
            });
        }
        return results;
    }
    
    // Full array parsing
    if (arr.length >= 20) {
        let homeIdx = -1, awayIdx = -1;
        
        for (let i = 5; i < Math.min(arr.length, 30); i++) {
            const val = arr[i];
            if (typeof val === 'string' && val.length > 2 && !isJunkTeam(val)) {
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
            const matchId = potentialMatchId || generateMatchId(home, away, '');
            
            // Cache it
            matchCache.set(matchId, { home, away, league: 'AFB88-Greedy' });
            
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
                    league: 'AFB88-Greedy',
                    market: 'HDP',
                    selection: 'Home',
                    odds: numbers[0],
                    provider: 'AFB88',
                    parsedAt: Date.now(),
                });
                results.push({
                    matchId,
                    home,
                    away,
                    league: 'AFB88-Greedy',
                    market: 'HDP',
                    selection: 'Away',
                    odds: numbers[1],
                    provider: 'AFB88',
                    parsedAt: Date.now(),
                });
            }
        }
    }
    
    return results;
}

// ============ HELPERS ============

function cleanTeamName(name: string): string {
    return name.replace(/<[^>]*>/g, '').trim();
}

function isJunkTeam(s: string): boolean {
    if (!s) return true;
    const clean = s.replace(/<[^>]*>/g, '').trim().toLowerCase();
    if (clean.length < 2) return true;
    
    // Time patterns
    if (/^\d{1,2}[\/:]\d{1,2}/.test(clean)) return true;
    if (clean.includes('am') || clean.includes('pm') || clean.includes("'")) return true;
    if (/^\d{1,2}\s*-\s*\d{1,2}$/.test(clean)) return true;
    
    const exactLabels = ['1h', '2h', 'ht', 'ft', 'live', 'all', 'closed'];
    const partialLabels = ['half time', 'today', 'early', 'streaming', 'postponed', 'waiting'];
    
    if (exactLabels.includes(clean)) return true;
    return partialLabels.some(l => clean.includes(l));
}

function generateMatchId(home: string, away: string, time: string): string {
    const h = home.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
    const a = away.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
    const t = time ? time.substring(0, 10).replace(/[^0-9]/g, '') : Date.now().toString().substring(5, 10);
    return `AFB_${h}_${a}_${t}`;
}
