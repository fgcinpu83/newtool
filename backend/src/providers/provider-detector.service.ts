/**
 * PROVIDER ROUTING SERVICE
 * =========================
 * Route traffic ke parser berdasarkan ACCOUNT, bukan domain.
 * 
 * SIMPLE RULE:
 * - Traffic dari Account A → Pakai parser yang di-assign ke A
 * - Traffic dari Account B → Pakai parser yang di-assign ke B
 * 
 * Domain detection DIHAPUS - user yang tentukan mapping.
 */

import { parseSabaPayload } from './saba/saba.parser';
import { parseAfb88Payload } from './afb88/afb88.parser';
import { ParseResult } from './base.provider';
import { ProviderType, SystemConfig, getProviderForAccount } from './account-binding.config';

export type DetectedProvider = 'SABA' | 'AFB88' | 'UNKNOWN';

export interface RoutingResult {
    provider: DetectedProvider;
    source: 'ACCOUNT_BINDING' | 'FALLBACK';
    account: 'A' | 'B' | 'UNKNOWN';
}

/**
 * Route traffic berdasarkan account binding
 * INI ADALAH FUNGSI UTAMA - gunakan ini untuk routing
 */
export function routeByAccount(account: 'A' | 'B', config: SystemConfig): RoutingResult {
    const provider = getProviderForAccount(config, account);
    
    if (provider === 'UNASSIGNED') {
        return {
            provider: 'UNKNOWN',
            source: 'FALLBACK',
            account,
        };
    }
    
    return {
        provider: provider as DetectedProvider,
        source: 'ACCOUNT_BINDING',
        account,
    };
}

/**
 * Parse payload berdasarkan provider type
 */
export function parseByProvider(provider: ProviderType | DetectedProvider, data: any): ParseResult {
    switch (provider) {
        case 'SABA':
            return parseSabaPayload(data);
        case 'AFB88':
            return parseAfb88Payload(data);
        default:
            return { odds: [], balance: null, rawMatchCount: 0 };
    }
}

/**
 * Main function: Route + Parse dalam satu call
 */
export function routeAndParse(account: 'A' | 'B', config: SystemConfig, data: any): {
    routing: RoutingResult;
    parsed: ParseResult;
} {
    const routing = routeByAccount(account, config);
    
    if (routing.provider === 'UNKNOWN') {
        return {
            routing,
            parsed: { odds: [], balance: null, rawMatchCount: 0 },
        };
    }
    
    const parsed = parseByProvider(routing.provider, data);
    
    return { routing, parsed };
}

/**
 * LEGACY SUPPORT: Detect provider dari URL (untuk backward compatibility)
 * Hanya digunakan jika account binding belum di-set
 * 
 * @deprecated Gunakan routeByAccount() sebagai gantinya
 */
export function detectProviderFromUrl(url: string): DetectedProvider {
    if (!url) return 'UNKNOWN';
    
    const lowUrl = url.toLowerCase();
    
    // SABA signatures (masih berguna untuk hint)
    if (lowUrl.includes('(s(') ||  // Session path pattern
        lowUrl.includes('aro') ||
        lowUrl.includes('msy') ||
        lowUrl.includes('mgf') ||
        lowUrl.includes('sabasports')) {
        return 'SABA';
    }
    
    // AFB88 signatures
    if (lowUrl.includes('pgbetodds') ||
        lowUrl.includes('fnoddsgen') ||
        lowUrl.includes('prosportslive') ||
        lowUrl.includes('growingjadeplant') ||
        lowUrl.includes('afb88')) {
        return 'AFB88';
    }
    
    return 'UNKNOWN';
}

/**
 * Check apakah URL ini noise (heartbeat, balance check, etc)
 * Berlaku untuk semua provider
 */
export function isNoiseEndpoint(url: string): boolean {
    if (!url) return true;
    
    const lowUrl = url.toLowerCase();
    const noisePatterns = [
        /heartbeat/i,
        /keepalive/i,
        /ping/i,
        /checksession/i,
        /getbalance/i,
        /balance/i,
        /announcement/i,
        /banner/i,
        /promotion/i,
        /servertime/i,
        /gettime/i,
        /pgmain/i,        // AFB88 heartbeat - PENTING!
        /statement/i,
        /betlistmini/i,
    ];
    
    return noisePatterns.some(p => p.test(lowUrl));
}

/**
 * Check apakah URL ini kemungkinan odds data
 */
export function isLikelyOddsEndpoint(url: string): boolean {
    if (!url) return false;
    
    const lowUrl = url.toLowerCase();
    const oddsPatterns = [
        /odds/i,
        /match/i,
        /event/i,
        /sport/i,
        /league/i,
        /market/i,
        /data/i,
    ];
    
    // Must match odds pattern AND not be noise
    return oddsPatterns.some(p => p.test(lowUrl)) && !isNoiseEndpoint(url);
}
