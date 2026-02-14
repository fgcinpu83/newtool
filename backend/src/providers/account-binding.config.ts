/**
 * ACCOUNT-PROVIDER BINDING CONFIG
 * ================================
 * User-driven configuration, TIDAK hardcode domain.
 * 
 * Flow:
 * 1. User set di Dashboard: Account A = SABA, Account B = AFB88
 * 2. User input URL bebas (qq188.com, mpo.com, whatever)
 * 3. System route traffic berdasarkan ACCOUNT, bukan domain
 * 
 * Benefit:
 * - Domain berubah? No problem, user tinggal ganti URL
 * - Tidak perlu maintain domain list
 * - Simple & predictable
 */

export type ProviderType = 'SABA' | 'AFB88' | 'UNASSIGNED';

export interface AccountBinding {
    /** Account identifier */
    account: 'A' | 'B';
    
    /** Provider yang di-assign ke account ini */
    provider: ProviderType;
    
    /** URL yang user input (untuk open browser) */
    url: string;
    
    /** Apakah account aktif? */
    active: boolean;
    
    /** Timestamp last update */
    updatedAt: number;
}

export interface SystemConfig {
    /** Account A binding */
    accountA: AccountBinding;
    
    /** Account B binding */
    accountB: AccountBinding;
    
    /** Minimum profit % untuk alert */
    minProfit: number;
    
    /** Maximum profit % cap (anti-anomaly) */
    maxProfit: number;
}

/**
 * Default config - user HARUS set provider sebelum mulai
 */
export const DEFAULT_CONFIG: SystemConfig = Object.freeze({
    accountA: {
        account: 'A',
        provider: 'UNASSIGNED',
        url: '',
        active: false,
        updatedAt: 0,
    },
    accountB: {
        account: 'B',
        provider: 'UNASSIGNED',
        url: '',
        active: false,
        updatedAt: 0,
    },
    minProfit: 1.5,
    maxProfit: 15.0,
}) as SystemConfig;

/**
 * Validate config sebelum system start
 */
export function validateConfig(config: SystemConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check Account A
    if (config.accountA.active) {
        if (config.accountA.provider === 'UNASSIGNED') {
            errors.push('Account A aktif tapi belum pilih provider');
        }
        if (!config.accountA.url) {
            errors.push('Account A aktif tapi URL kosong');
        }
    }
    
    // Check Account B
    if (config.accountB.active) {
        if (config.accountB.provider === 'UNASSIGNED') {
            errors.push('Account B aktif tapi belum pilih provider');
        }
        if (!config.accountB.url) {
            errors.push('Account B aktif tapi URL kosong');
        }
    }
    
    // At least one account must be active for arbitrage
    if (!config.accountA.active && !config.accountB.active) {
        errors.push('Minimal 1 account harus aktif');
    }
    
    // Both must be active for arbitrage (cross-account comparison)
    if (config.accountA.active !== config.accountB.active) {
        errors.push('Untuk arbitrage, kedua account harus aktif');
    }
    
    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Get provider for account
 * Ini yang dipakai untuk routing traffic ke parser
 */
export function getProviderForAccount(config: SystemConfig, account: 'A' | 'B'): ProviderType {
    if (account === 'A') {
        return config.accountA.provider;
    }
    return config.accountB.provider;
}

/**
 * 🎯 v10.0: Get account for provider (REVERSE LOOKUP)
 * Digunakan untuk route incoming traffic dari detected provider ke correct account.
 * 
 * FLEXIBLE: Provider bisa di account manapun tergantung user config.
 * TIDAK HARDCODE: ISPORT bisa di A atau B, AFB88 bisa di A atau B.
 */
export function getAccountForProvider(config: SystemConfig, provider: ProviderType): 'A' | 'B' | null {
    // Check Account A first
    if (config.accountA.active && config.accountA.provider === provider) {
        return 'A';
    }
    // Check Account B
    if (config.accountB.active && config.accountB.provider === provider) {
        return 'B';
    }
    // Provider not assigned to any active account
    return null;
}

/**
 * 🎯 v10.0: Detect provider from URL patterns
 * PURE DETECTION - hanya identifikasi provider, TIDAK assign account.
 */
export function detectProviderFromUrl(url: string): ProviderType {
    const lowerUrl = url.toLowerCase();
    
    // AFB88 patterns
    const AFB88_PATTERNS = [
        'jps9', 'prosportslive', 'wsfev2', 'fnoddsgen', 'linkcdn', 'growingjadeplant',
        'afb88', '/pgmain', '/pgbetodds', '/api/pg'
    ];
    if (AFB88_PATTERNS.some(p => lowerUrl.includes(p))) {
        return 'AFB88';
    }
    
    // SABA/ISPORT patterns
    const SABA_PATTERNS = [
        'qq188', 'aro', 'msy', 'mgf', 'lvx', 'saba', 'b8d6', 'lcvc092n',
        '(s(', '/betting/', 'getodds', 'getmatchlist'
    ];
    if (SABA_PATTERNS.some(p => lowerUrl.includes(p))) {
        return 'SABA';
    }
    
    return 'UNASSIGNED';
}

/**
 * 🎯 v10.0: Route incoming traffic to correct account
 * FLOW: URL → Detect Provider → Lookup Config → Return Account
 * 
 * @returns account ('A' | 'B') or null if unroutable
 */
export function routeTrafficToAccount(
    config: SystemConfig, 
    url: string, 
    hintProvider?: string, 
    hintAccount?: string
): { account: 'A' | 'B' | null; provider: ProviderType; source: string } {
    
    // Step 1: Detect provider from URL
    let detectedProvider = detectProviderFromUrl(url);
    
    // Step 2: Override with hint if provided and valid
    if (hintProvider && ['SABA', 'ISPORT', 'AFB88'].includes(hintProvider.toUpperCase())) {
        // Normalize ISPORT to SABA for consistency
        detectedProvider = hintProvider.toUpperCase() === 'ISPORT' ? 'SABA' : hintProvider.toUpperCase() as ProviderType;
    }
    
    // Step 3: Lookup account from config
    const account = getAccountForProvider(config, detectedProvider);
    
    // Step 4: If no match and hint account provided, use it
    if (!account && hintAccount && (hintAccount === 'A' || hintAccount === 'B')) {
        // Validate hint account is active
        const binding = hintAccount === 'A' ? config.accountA : config.accountB;
        if (binding.active) {
            return { 
                account: hintAccount, 
                provider: binding.provider, 
                source: 'HINT_ACCOUNT' 
            };
        }
    }
    
    return {
        account,
        provider: detectedProvider,
        source: account ? 'CONFIG_LOOKUP' : 'UNROUTABLE'
    };
}
