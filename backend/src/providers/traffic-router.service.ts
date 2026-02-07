/**
 * SIMPLIFIED TRAFFIC ROUTER
 * ==========================
 * Clean implementation untuk route traffic ke parser.
 * 
 * Digunakan oleh worker.service.ts sebagai replacement
 * untuk logic provider detection yang tersebar.
 */

import { Injectable, Logger } from '@nestjs/common';
import { 
    routeAndParse, 
    isNoiseEndpoint, 
    isLikelyOddsEndpoint,
    SystemConfig,
    ProviderType,
    ParseResult,
    RoutingResult 
} from '../providers';
import { RedisService } from '../shared/redis.service';
import { ProviderSessionManager } from '../managers/provider-session.manager';

export interface TrafficPacket {
    account: 'A' | 'B';
    url: string;
    type: string;
    data: any;
    clientId?: string;
    timestamp?: number;
}

export interface ProcessedTraffic {
    routing: RoutingResult;
    parsed: ParseResult;
    shouldProcess: boolean;
    reason: string;
}

@Injectable()
export class TrafficRouterService {
    private readonly logger = new Logger(TrafficRouterService.name);
    
    // Cache config agar tidak query Redis setiap packet
    private configCache: SystemConfig | null = null;
    private configCacheTime: number = 0;
    private readonly CONFIG_CACHE_TTL = 5000; // 5 detik
    
    constructor(
        private redisService: RedisService,
        private providerManager: ProviderSessionManager
    ) {}
    
    /**
     * Main entry point: Process incoming traffic
     */
    async processTraffic(packet: TrafficPacket): Promise<ProcessedTraffic> {
        const { account, url, type, data } = packet;
        
        // 1. Skip noise endpoints
        if (isNoiseEndpoint(url)) {
            return {
                routing: { provider: 'UNKNOWN', source: 'FALLBACK', account },
                parsed: { odds: [], balance: null, rawMatchCount: 0 },
                shouldProcess: false,
                reason: 'Noise endpoint (heartbeat/balance/etc)',
            };
        }
        
        // 2. Get config (cached)
        const config = await this.getConfig();
        
        // 3. Check if account is active
        const accountConfig = account === 'A' ? config.accountA : config.accountB;
        if (!accountConfig.active) {
            return {
                routing: { provider: 'UNKNOWN', source: 'FALLBACK', account },
                parsed: { odds: [], balance: null, rawMatchCount: 0 },
                shouldProcess: false,
                reason: `Account ${account} is not active`,
            };
        }
        
        // 3.5. Check if account has ready providers
        if (!this.providerManager.isAccountReady(account)) {
            return {
                routing: { provider: 'UNKNOWN', source: 'FALLBACK', account },
                parsed: { odds: [], balance: null, rawMatchCount: 0 },
                shouldProcess: false,
                reason: `Account ${account} has no ready providers`,
            };
        }
        
        // 4. Check if provider is assigned
        if (accountConfig.provider === 'UNASSIGNED') {
            return {
                routing: { provider: 'UNKNOWN', source: 'FALLBACK', account },
                parsed: { odds: [], balance: null, rawMatchCount: 0 },
                shouldProcess: false,
                reason: `Account ${account} has no provider assigned`,
            };
        }
        
        // 5. Route and parse
        const { routing, parsed } = routeAndParse(account, config, data);
        
        // 6. Determine if we should process
        const shouldProcess = parsed.odds.length > 0 || parsed.balance !== null;
        
        return {
            routing,
            parsed,
            shouldProcess,
            reason: shouldProcess 
                ? `Found ${parsed.odds.length} odds, balance=${parsed.balance}` 
                : 'No odds or balance found',
        };
    }
    
    /**
     * Get config with caching
     */
    private async getConfig(): Promise<SystemConfig> {
        const now = Date.now();
        
        // Return cached if still valid
        if (this.configCache && (now - this.configCacheTime) < this.CONFIG_CACHE_TTL) {
            return this.configCache;
        }
        
        // Fetch from Redis
        try {
            const redisConfig = await this.redisService.getConfig();
            
            // Transform Redis config to SystemConfig format
            this.configCache = {
                accountA: {
                    account: 'A',
                    provider: (redisConfig.providerA || 'UNASSIGNED') as ProviderType,
                    url: redisConfig.urlA || '',
                    active: redisConfig.accountA_active || false,
                    updatedAt: Date.now(),
                },
                accountB: {
                    account: 'B',
                    provider: (redisConfig.providerB || 'UNASSIGNED') as ProviderType,
                    url: redisConfig.urlB || '',
                    active: redisConfig.accountB_active || false,
                    updatedAt: Date.now(),
                },
                minProfit: redisConfig.min || 1.5,
                maxProfit: redisConfig.max || 15.0,
            };
            
            this.configCacheTime = now;
            return this.configCache;
            
        } catch (e) {
            this.logger.error(`Failed to get config from Redis: ${e.message}`);
            
            // Return default if Redis fails
            return {
                accountA: { account: 'A', provider: 'UNASSIGNED', url: '', active: false, updatedAt: 0 },
                accountB: { account: 'B', provider: 'UNASSIGNED', url: '', active: false, updatedAt: 0 },
                minProfit: 1.5,
                maxProfit: 15.0,
            };
        }
    }
    
    /**
     * Invalidate config cache (call when config changes)
     */
    invalidateConfigCache(): void {
        this.configCache = null;
        this.configCacheTime = 0;
    }
    
    /**
     * Get provider for account (helper untuk status display)
     */
    async getProviderForAccount(account: 'A' | 'B'): Promise<ProviderType> {
        const config = await this.getConfig();
        if (account === 'A') {
            return config.accountA.provider;
        }
        return config.accountB.provider;
    }
    
    /**
     * Check if both accounts are properly configured for arbitrage
     */
    async isReadyForArbitrage(): Promise<{ ready: boolean; errors: string[] }> {
        const config = await this.getConfig();
        const errors: string[] = [];
        
        if (!config.accountA.active) {
            errors.push('Account A tidak aktif');
        } else if (config.accountA.provider === 'UNASSIGNED') {
            errors.push('Account A belum pilih provider');
        }
        
        if (!config.accountB.active) {
            errors.push('Account B tidak aktif');
        } else if (config.accountB.provider === 'UNASSIGNED') {
            errors.push('Account B belum pilih provider');
        }
        
        return {
            ready: errors.length === 0,
            errors,
        };
    }
}
