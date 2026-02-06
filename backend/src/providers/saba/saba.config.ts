/**
 * SABA/ISPORT PROVIDER CONFIG
 * ============================
 * Whitelabel: QQ188, dan sejenisnya
 * 
 * SABA characteristics:
 * - Session token embedded di URL path: /(S(xxxxx))/
 * - Data format: JSON dengan nested structure
 * - Odds auto-refresh setelah navigate ke Sports
 * 
 * Jika ada update/bug SABA, edit file INI saja.
 */

import { ProviderConfig } from '../base.provider';

export const SABA_CONFIG: ProviderConfig = {
    name: 'SABA',
    
    profile: 'PATH_SESSION',
    
    whitelabels: ['QQ188', 'JPS9', 'VPE8557', 'LVX3306'],
    
    /**
     * Domain patterns untuk detect SABA iframe
     * SABA biasanya di-embed dalam iframe dengan domain berbeda
     */
    domains: [
        { pattern: /aro\d*\.com/i, description: 'SABA aro domain' },
        { pattern: /msy\d*\.com/i, description: 'SABA msy domain' },
        { pattern: /mgf\d*\.com/i, description: 'SABA mgf domain' },
        { pattern: /b8d6.*\.com/i, description: 'SABA b8d6 domain' },
        { pattern: /lvx\d*\.com/i, description: 'SABA lvx domain' },
        { pattern: /vpe\d*\.com/i, description: 'SABA vpe domain' },
        { pattern: /qq188/i, description: 'QQ188 main domain' },
        { pattern: /depositprocesslogin/i, description: 'SABA deposit domain' },
        { pattern: /\(s\([^)]+\)\)/i, description: 'SABA session path pattern' },
    ],
    
    /**
     * Endpoints yang mengandung odds data (SUBSTANTIVE)
     * Hanya process jika URL match salah satu pattern ini
     */
    oddsEndpoints: [
        /getodds/i,
        /getmatchlist/i,
        /matchlist/i,
        /\/sports\//i,
        /\/data\//i,
        /eventlist/i,
        /leaguelist/i,
        /matchitems/i,
        /oddsitems/i,
    ],
    
    /**
     * Endpoints yang noise (SKIP)
     * Jangan process, hanya update heartbeat timestamp
     */
    noiseEndpoints: [
        /heartbeat/i,
        /checksession/i,
        /keepalive/i,
        /ping/i,
        /getbalance/i,
        /betlistmini/i,
        /statement/i,
        /announcement/i,
        /banner/i,
        /promotion/i,
        /gettime/i,
        /servertime/i,
    ],
    
    requiresActivator: false, // SABA auto-push setelah navigate
    
    keepalive: {
        intervalMs: 30000,  // 30 detik
        timeoutMs: 180000,  // 3 menit session timeout
    },
    
    /**
     * Keys untuk extract balance dari response
     * Urutan = prioritas (atas lebih tinggi)
     */
    balanceKeys: [
        'balance', 'Balance',
        'availableBalance', 'AvailableBalance', 
        'credit', 'Credit',
        'uBal', 'ubal',
        'ba', 'Ba', 'BA',
        'cash', 'Cash',
        'available', 'Available',
    ],
};

/**
 * SABA-specific session token extractor
 * URL format: https://domain.com/(S(abc123xyz))/Sports/...
 */
export function extractSabaSessionToken(url: string): string | null {
    const match = url.match(/\(s\(([^)]+)\)\)/i);
    return match ? match[1] : null;
}

/**
 * Check if URL has valid SABA session
 */
export function hasSabaSession(url: string): boolean {
    return extractSabaSessionToken(url) !== null;
}
