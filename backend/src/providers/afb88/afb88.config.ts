/**
 * AFB88 PROVIDER CONFIG
 * ======================
 * Whitelabel: MPO, dan sejenisnya
 * 
 * AFB88 characteristics:
 * - EVENT_DRIVEN: Butuh klik UI untuk trigger odds
 * - Data via WebSocket (fnOddsGen) atau XHR (pgBetOdds)
 * - Payload bisa di-GZIP compress (H4s... prefix)
 * - Token Authorization dinamis
 * 
 * Jika ada update/bug AFB88, edit file INI saja.
 */

import { ProviderConfig } from '../base.provider';

export const AFB88_CONFIG: ProviderConfig = Object.freeze({
    name: 'AFB88',
    
    profile: 'EVENT_DRIVEN',
    
    whitelabels: ['MPO', 'EZC', 'JPS9', 'GROWINGJADEPLANT'],
    
    /**
     * Domain patterns untuk detect AFB88
     * AFB88 bisa embedded atau direct access
     */
    domains: [
        { pattern: /prosportslive\.net/i, description: 'AFB88 WebSocket domain' },
        { pattern: /wsfev2/i, description: 'AFB88 WS endpoint' },
        { pattern: /fnoddsgen/i, description: 'AFB88 odds generator' },
        { pattern: /linkcdn/i, description: 'AFB88 CDN domain' },
        { pattern: /afb88/i, description: 'AFB88 direct domain' },
        { pattern: /mpo.*sport/i, description: 'MPO sport domain' },
        { pattern: /ezc.*sport/i, description: 'EZC sport domain' },
        { pattern: /pgbetodds/i, description: 'AFB88 odds endpoint' },
        { pattern: /growingjadeplant/i, description: 'AFB88 whitelabel domain' },
    ],
    
    /**
     * Endpoints yang mengandung odds data (SUBSTANTIVE)
     * AFB88 menggunakan pgBetOdds sebagai main odds endpoint
     */
    oddsEndpoints: [
        /pgbetodds/i,
        /fnoddsgen/i,
        /odds_batch/i,
        /getodds/i,
        /matchlist/i,
        /sportitems/i,
    ],
    
    /**
     * Endpoints yang noise (SKIP)
     * pgMain adalah heartbeat, JANGAN process sebagai odds
     */
    noiseEndpoints: [
        /pgmain/i,           // ⚠️ CRITICAL: pgMain adalah heartbeat, BUKAN odds
        /heartbeat/i,
        /ping/i,
        /getbalance/i,
        /balance/i,
        /announcement/i,
        /banner/i,
        /maintenance/i,
        /servertime/i,
    ],
    
    requiresActivator: true, // ⚠️ CRITICAL: Harus klik market untuk dapat odds
    
    keepalive: {
        intervalMs: 45000,   // 45 detik
        timeoutMs: 300000,   // 5 menit session timeout
    },
    
    /**
     * Keys untuk extract balance dari response
     */
    balanceKeys: [
        'balance', 'Balance',
        'credit', 'Credit',
        'availableBalance', 'AvailableBalance',
        'cash', 'Cash',
        'ba', 'Ba', 'BA',
        'Balance2D', 'Balance2',
        'uBal', 'ubal',
    ],
});

/**
 * Check if payload is GZIP compressed (Base64 encoded)
 * AFB88 sometimes sends compressed data starting with "H4s"
 */
export function isGzipPayload(data: any): boolean {
    if (typeof data === 'string') {
        return data.startsWith('H4s') || data.startsWith('H4S');
    }
    return false;
}

/**
 * Extract AFB88 Authorization token from headers
 */
export function extractAfbToken(headers: Record<string, string>): string | null {
    const authKeys = ['Authorization', 'authorization', 'X-Auth-Token', 'x-auth-token', 'usetoken'];
    for (const key of authKeys) {
        if (headers[key] && headers[key].length > 10) {
            return headers[key];
        }
    }
    return null;
}
