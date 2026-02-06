/**
 * BASE PROVIDER - Abstract Definition
 * ====================================
 * Semua provider HARUS implement interface ini.
 * Ini adalah "kontrak" yang wajib dipatuhi.
 */

export type ProviderProfile = 
    | 'AUTO_PUSH'       // Data otomatis mengalir setelah page load
    | 'PATH_SESSION'    // Session token ada di URL path
    | 'EVENT_DRIVEN';   // Butuh interaksi UI untuk trigger data

export interface DomainPattern {
    /** Regex pattern untuk detect domain provider */
    pattern: RegExp;
    /** Deskripsi untuk logging */
    description: string;
}

export interface ProviderConfig {
    /** Nama provider (unique identifier) */
    name: string;
    
    /** Profile arsitektur */
    profile: ProviderProfile;
    
    /** Whitelabel yang menggunakan provider ini */
    whitelabels: string[];
    
    /** Domain patterns untuk deteksi */
    domains: DomainPattern[];
    
    /** URL patterns yang mengandung odds data (substantive) */
    oddsEndpoints: RegExp[];
    
    /** URL patterns yang hanya heartbeat/noise (ignore) */
    noiseEndpoints: RegExp[];
    
    /** Apakah butuh aktivasi UI untuk dapat odds? */
    requiresActivator: boolean;
    
    /** Session keepalive config */
    keepalive: {
        intervalMs: number;
        timeoutMs: number;
    };
    
    /** Balance extraction keys (prioritas tinggi ke rendah) */
    balanceKeys: string[];
}

/**
 * Base class untuk semua provider
 * Provider baru harus extend class ini
 */
export abstract class BaseProvider {
    abstract readonly config: ProviderConfig;
    
    /**
     * Check apakah URL ini milik provider ini
     */
    matchesDomain(url: string): boolean {
        const lowUrl = url.toLowerCase();
        return this.config.domains.some(d => d.pattern.test(lowUrl));
    }
    
    /**
     * Check apakah URL ini adalah odds endpoint (data penting)
     */
    isOddsEndpoint(url: string): boolean {
        const lowUrl = url.toLowerCase();
        return this.config.oddsEndpoints.some(p => p.test(lowUrl));
    }
    
    /**
     * Check apakah URL ini noise (skip processing)
     */
    isNoiseEndpoint(url: string): boolean {
        const lowUrl = url.toLowerCase();
        return this.config.noiseEndpoints.some(p => p.test(lowUrl));
    }
    
    /**
     * Parse raw payload menjadi normalized odds
     * Setiap provider implement sendiri
     */
    abstract parsePayload(data: any): ParseResult;
}

export interface ParseResult {
    odds: ParsedOdds[];
    balance: number | null;
    rawMatchCount: number;
}

export interface ParsedOdds {
    matchId: string;
    home: string;
    away: string;
    league: string;
    market: 'HDP' | 'OU' | 'ML' | '1X2';
    selection: string;
    line?: string;
    odds: number;
    scheduledTime?: string;
    provider: string;
    parsedAt: number;
}
