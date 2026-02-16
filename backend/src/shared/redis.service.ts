import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import dns from 'dns';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private client: Redis;
    private configCache: any = null;

    async onModuleInit() {
        // Prefer container service name for Redis when available; if it cannot be
        // resolved fall back to localhost so the runtime remains usable in dev.
        let candidateHost = process.env.REDIS_HOST || 'redis-service';
        const port = parseInt(process.env.REDIS_PORT || '6379');

        try {
            await (dns.promises.lookup(candidateHost));
        } catch (e) {
            // DNS lookup failed — try localhost fallback
            console.warn('[REDIS] DNS lookup failed for', candidateHost, 'falling back to 127.0.0.1');
            candidateHost = '127.0.0.1';
        }

        this.client = new Redis({
            host: candidateHost,
            port,
        });

        // Prevent ioredis unhandled 'error' events from crashing the process in dev.
        this.client.on('error', (err) => {
            console.warn('[REDIS] client error (non-fatal):', err && err.message ? err.message : String(err));
        });
    }

    onModuleDestroy() {
        this.client.quit();
    }

    getClient(): Redis {
        return this.client;
    }

    async setConfig(config: any) {
        this.configCache = config;
        try {
            await this.client.set('arbitrage_config', JSON.stringify(config));
        } catch (e) {
            // Non-fatal: log and continue so missing Redis doesn't break bootstrap/tests
            console.warn('[REDIS] setConfig failed (non-fatal):', e && e.message ? e.message : String(e));
        }
        // Optional: Publish update event if needed for other instances
    }

    async getConfig(): Promise<any> {
        if (this.configCache) return this.configCache;

        try {
            const raw = await this.client.get('arbitrage_config');
            if (raw) {
                this.configCache = JSON.parse(raw);
            } else {
                this.configCache = this.getDefaultConfig();
            }
        } catch (e) {
            console.warn('[REDIS] Connection failed, using default config.', e.message);
            this.configCache = this.getDefaultConfig();
        }
        return this.configCache;
    }

    private getDefaultConfig() {
        return {
            min: 0.5,
            max: 5.0,
            accountA_active: false,
            accountB_active: false,
            urlA: '',
            urlB: ''
        };
    }


    async saveContract(account: string, provider: string, contract: any) {
        const key = `contract_${account.toLowerCase()}_${provider.toLowerCase()}`;
        try {
            await this.client.set(key, JSON.stringify(contract), 'EX', 86400); // 24h TTL
        } catch (e) {
            console.warn('[REDIS] saveContract failed (non-fatal):', e && e.message ? e.message : String(e));
        }
    }

    async loadContract(account: string, provider: string): Promise<any | null> {
        const key = `contract_${account.toLowerCase()}_${provider.toLowerCase()}`;
        try {
            const raw = await this.client.get(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn('[REDIS] loadContract failed (non-fatal):', e && e.message ? e.message : String(e));
            return null;
        }
    }

    // 🛡️ v3.1 LOCKED - Generic set/get for session persistence
    async set(key: string, value: string, ttl?: number): Promise<void> {
        try {
            if (ttl) {
                await this.client.set(key, value, 'EX', ttl);
            } else {
                await this.client.set(key, value);
            }
        } catch (e) {
            console.warn('[REDIS] set failed (non-fatal):', e && e.message ? e.message : String(e));
        }
    }

    async get(key: string): Promise<string | null> {
        try {
            return await this.client.get(key);
        } catch (e) {
            console.warn('[REDIS] get failed (non-fatal):', e && e.message ? e.message : String(e));
            return null;
        }
    }

    invalidateCache() {
        this.configCache = null;
    }
}
