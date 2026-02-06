import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private client: Redis;
    private configCache: any = null;

    onModuleInit() {
        this.client = new Redis({
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT || '6379'),
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
        await this.client.set('arbitrage_config', JSON.stringify(config));
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
        await this.client.set(key, JSON.stringify(contract), 'EX', 86400); // 24h TTL
    }

    async loadContract(account: string, provider: string): Promise<any | null> {
        const key = `contract_${account.toLowerCase()}_${provider.toLowerCase()}`;
        const raw = await this.client.get(key);
        return raw ? JSON.parse(raw) : null;
    }

    // 🛡️ v3.1 LOCKED - Generic set/get for session persistence
    async set(key: string, value: string, ttl?: number): Promise<void> {
        if (ttl) {
            await this.client.set(key, value, 'EX', ttl);
        } else {
            await this.client.set(key, value);
        }
    }

    async get(key: string): Promise<string | null> {
        return await this.client.get(key);
    }

    invalidateCache() {
        this.configCache = null;
    }
}
