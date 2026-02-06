import { Injectable } from '@nestjs/common';

@Injectable()
export class NormalizationService {

    // Cache sederhana untuk performa
    private cache = new Map<string, string>();

    // 🛡️ v6.0 ULTRA-FAST SYNC - Maximum allowed timestamp difference (ms)
    private readonly MAX_TIMESTAMP_DIFF_MS = 2000;

    /**
     * 🛡️ v6.0 ULTRA-FAST SYNC
     * Validates that the timestamp difference between two data sources is within acceptable limits.
     * If the difference exceeds MAX_TIMESTAMP_DIFF_MS (1000ms), the pair should be DISCARDED.
     * 
     * @param timestampA - Timestamp from provider A (AFB88) in milliseconds
     * @param timestampB - Timestamp from provider B (SABA) in milliseconds
     * @returns Object with isSync (boolean) and diff (number in ms)
     */
    public checkTimestampSync(timestampA: number, timestampB: number): { isSync: boolean; diff: number; reason: string } {
        // Handle missing timestamps
        if (!timestampA || !timestampB) {
            return {
                isSync: false,
                diff: -1,
                reason: 'MISSING_TIMESTAMP'
            };
        }

        const diff = Math.abs(timestampA - timestampB);

        if (diff > this.MAX_TIMESTAMP_DIFF_MS) {
            return {
                isSync: false,
                diff,
                reason: `STALE_DATA: ${diff}ms exceeds ${this.MAX_TIMESTAMP_DIFF_MS}ms threshold`
            };
        }

        return {
            isSync: true,
            diff,
            reason: 'SYNC_OK'
        };
    }

    /**
     * 🛡️ v6.0 Validate pair freshness for arbitrage
     * Returns true if both timestamps are fresh enough for arbitrage execution
     */
    public isPairFreshForArbitrage(afbTimestamp: number, sabaTimestamp: number): boolean {
        const result = this.checkTimestampSync(afbTimestamp, sabaTimestamp);
        if (!result.isSync) {
            console.log(`[ULTRA-FAST-SYNC] ❌ DISCARDING PAIR: ${result.reason}`);
        }
        return result.isSync;
    }

    /**
     * Get the maximum allowed timestamp difference
     */
    public getMaxTimestampDiff(): number {
        return this.MAX_TIMESTAMP_DIFF_MS;
    }

    // 🛡️ v3.5 Kamus Normalisasi (Extended with comprehensive abbreviations)
    private dictionary: Record<string, string> = {
        // === COMMON CLUB PREFIXES/SUFFIXES (strip) ===
        'fc': '',
        'fk': '',
        'sc': '',
        'ac': '',
        'cf': '',
        'as': '',
        'ss': '',
        'bk': '',
        'sk': '',
        'sv': '',
        'vfb': '',
        'vfl': '',
        'tsv': '',
        'bsc': '',
        'bsv': '',
        'afc': '',
        'rfc': '',
        'cfc': '',
        'sfc': '',
        'kfc': '',
        'ofc': '',
        'dfc': '',
        'mfc': '',
        'lfc': '',
        'hfc': '',
        'pfc': '',
        'nk': '',
        'fbc': '',
        'ssc': '',
        'usc': '',
        'gfc': '',
        'asc': '',
        'rsc': '',

        // === COMMON ABBREVIATION EXPANSIONS ===
        'utd': 'united',
        'united': 'united',
        'unted': 'united',
        'untd': 'united',
        'real': 'real',
        'rl': 'real',
        'city': 'city',
        'cty': 'city',
        'town': 'town',
        'twn': 'town',
        'athletic': 'atl',
        'athl': 'athletic',
        'ath': 'athletic',
        'rovers': 'rovers',
        'rvrs': 'rovers',
        'wanderers': 'wanderers',
        'wndrs': 'wanderers',
        'albion': 'albion',
        'alb': 'albion',
        'hotspur': 'hotspur',
        'spurs': 'hotspur',
        'villa': 'villa',
        'palace': 'palace',
        'county': 'county',
        'forest': 'forest',
        'rangers': 'rangers',
        'calcio': '',
        'club': '',
        'sporting': 'spot',
        'sport': 'sporting',
        'sportivo': 'sportivo',
        'deportivo': 'dep',
        'dynamo': 'dynamo',
        'dinamo': 'dynamo',
        'olympique': 'olympique',
        'olimpia': 'olimpia',
        'olympic': 'olympic',

        // === EPL SHORTCUTS ===
        'man': 'manchester',
        'manc': 'manchester',
        'm.u': 'manchester united',
        'm.c': 'manchester city',
        'mu': 'manchester united',
        'mc': 'manchester city',
        'manu': 'manchester united',
        'liv': 'liverpool',
        'ars': 'arsenal',
        'che': 'chelsea',
        'tot': 'tottenham',
        'lei': 'leicester',
        'whu': 'west ham',
        'eve': 'everton',
        'new': 'newcastle',
        'avl': 'aston villa',
        'wol': 'wolves',
        'wolverhampton': 'wolves',
        'bha': 'brighton',
        'cry': 'crystal palace',
        'bur': 'burnley',
        'sou': 'southampton',
        'wat': 'watford',
        'nor': 'norwich',
        'ful': 'fulham',
        'lee': 'leeds',
        'bou': 'bournemouth',
        'shf': 'sheffield',
        'nfo': 'nottingham',
        'bre': 'brentford',
        'bri': 'brighton',
        'lut': 'luton',

        // === MISC (strip) ===
        'the': '',
        'de': '',
        'la': '',
        'un': '',
        'el': '',
        'los': '',
        'las': '',
        'dos': '',
        'das': '',
        'atletico': 'atl',
        'vic': 'victory',

        // === IGNORED WORDS ===
        'v': '',
        'vs': '',
        'youth': '',
        'women': '',
        'w': '',
        'u17': '',
        'u18': '',
        'u19': '',
        'u20': '',
        'u21': '',
        'u23': '',
        'reserves': '',
        'res': '',
        'reserve': '',
        'ii': '',
        'b': '',

        // === WHITELABEL PREFIXES/SUFFIXES ===
        'mpo': '',
        'qq': '',
        'bola': '',
        'bet': '',
        'slot': '',
        '88': '',
        '188': '',
        '1221': '',

        // === INDONESIAN CLUBS ===
        'pss': 'pss sleman',
        'psm': 'psm makassar',
        'psis': 'psis semarang',
        'persib': 'persib bandung',
        'persija': 'persija jakarta',
        'arema': 'arema fc',
        'bali': 'bali united',
        'persebaya': 'persebaya surabaya',
        'ran': 'rancansari',

        // === E-SPORTS (strip) ===
        'e-': '',
        'esim': '',
        'esports': '',
        'gaming': '',
        'cyber': '',
    };

    /**
     * Membersihkan nama tim menjadi bentuk standar
     */
    public normalize(name: string): string {
        if (!name) return '';
        if (this.cache.has(name)) return this.cache.get(name);

        let normalized = name.toLowerCase();

        // 🛡️ v7.0 REGEX-FIRST STRIP PREFIXES
        // Removes common whitelabel branding that interferes with matching
        const whitelabelPrefixes = /^(mpo|qq|188|cmd|afb|bola|bet|slot|88|1221|cyber|royal|id|idn|v?vip)\s*[-_]?\s*/gi;
        normalized = normalized.replace(whitelabelPrefixes, '');

        // Remove common suffixes/tags
        normalized = normalized.replace(/\s*[-_]?\s*(official|gaming|sports|play|win|asia|indonesia|ind|betting)$/gi, '');

        // Standard replacements (legacy)
        normalized = normalized
            .replace(/\(([^0-9]{3,})\)/g, ' ') // Strip parentheses ONLY if they contain at least 3 non-numeric chars
            .replace(/[()]/g, ' ')          // Strip remaining parentheses but keep content
            .replace(/\[\d+\]/g, ' ')      // Remove ranks [12]
            .replace(/\d+\s*-\s*\d+/g, ' ') // Remove scores 0-0
            .replace(/[^\w\s]/g, ' ')      // Remove special chars, keep spaces
            .replace(/\s+/g, ' ')          // Standardize spaces
            .trim();

        // Special abbreviations mapping
        const words = normalized.split(' ');
        const mapped = words.map(word => this.dictionary[word] || word);

        const result = mapped.join(' ').trim();
        if (name.length > 3) {
            console.log(`[NORM-DEBUG] "${name}" -> "${result}"`);
        }
        this.cache.set(name, result);
        return result;
    }

    /**
     * 🛡️ v7.4 AGGRESSIVE MATCHING - Comparing two team names.
     * Threshold: 0.55 (55% similarity) - Adjusted for cross-provider variation
     */
    public readonly MATCH_THRESHOLD = 0.55;

    isSameTeam(nameA: string, nameB: string, threshold = this.MATCH_THRESHOLD): boolean {
        return this.getSimilarity(nameA, nameB) >= threshold;
    }

    public getSimilarity(nameA: string, nameB: string): number {
        const normA = this.normalize(nameA);
        const normB = this.normalize(nameB);

        if (!normA && !normB) return 1;
        if (!normA || !normB) return 0;

        if (normA === normB) return 1;

        // 🛡️ v7.4 TOKEN-BASED SYMMETRIC MATCHING (Jaccard-ish)
        const setA = new Set(normA.split(' ').filter(w => w.length > 2));
        const setB = new Set(normB.split(' ').filter(w => w.length > 2));

        if (setA.size > 0 && setB.size > 0) {
            const intersection = new Set([...setA].filter(x => setB.has(x)));
            const jaccard = intersection.size / Math.min(setA.size, setB.size); // Subset similarity
            if (jaccard >= 0.8) return 0.90; // High confidence token match
        }

        // 🛡️ v3.4: Enhanced partial matching
        if (normA.includes(normB) || normB.includes(normA)) return 0.95;

        // Check if first word matches
        const wordsA = normA.split(' ');
        const wordsB = normB.split(' ');
        if (wordsA[0] && wordsB[0] && wordsA[0] === wordsB[0] && wordsA[0].length > 4) {
            return 0.85;
        }

        const dist = this.levenshtein(normA, normB);
        const len = Math.max(normA.length, normB.length);
        const levSim = 1 - (dist / len);

        return levSim;
    }

    /**
     * Algoritma Levenshtein Distance Standard
     */
    private levenshtein(a: string, b: string): number {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(
                            matrix[i][j - 1] + 1, // insertion
                            matrix[i - 1][j] + 1  // deletion
                        )
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    // --- IDENTITY HELPERS ---

    public generateTeamFingerprint(name: string): string {
        // 1. Normalize
        const norm = this.normalize(name);
        // 2. Tokenize & Filter Empty
        const tokens = norm.split(' ').filter(t => t.length > 0);
        // 3. Sort Alphabetically (Deterministic)
        tokens.sort();
        // 4. Join and Hash (or just join if short)
        return tokens.join('_');
    }

    public normalizeLeague(league: string): string {
        if (!league) return 'unknown';
        // Simple normalization for now
        return league.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '_')
            .trim();
    }
}
