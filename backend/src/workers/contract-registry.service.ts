import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface SportsbookContract {
    provider: string;
    profile: string;
    url?: string;
    authorization?: string;
    usetoken?: any;
    sinfo?: string; // 🛡️ v3.1 Security Info / Token
    baseUrl?: string;
    headers?: any;
    cookies?: string;
    userAgent?: string;
    lastUpdated?: number;
}

@Injectable()
export class ContractRegistry implements OnModuleInit {
    private DYNAMIC_CONFIG_PATH = path.join(process.cwd(), 'dynamic_contracts.json');
    private CONTRACT_STORAGE_PATH = path.join(process.cwd(), 'harvested_contracts.json');

    private mappings = [
        { pattern: /pgBetOdds/i, provider: 'AFB88', profile: 'EVENT_DRIVEN' },
        { pattern: /pgMain/i, provider: 'AFB88', profile: 'HEARTBEAT' },
        { pattern: /wfMain/i, provider: 'AFB88', profile: 'HEARTBEAT' },
        { pattern: /jps9|mpo|linkcdn|wsfev2|prosportslive|growingjadeplant/i, provider: 'AFB88', profile: 'EVENT_DRIVEN' },
        { pattern: /SportItems/i, provider: 'CMD368', profile: 'AUTO_PUSH' },
        { pattern: /getMatch/i, provider: 'CMD368', profile: 'AUTO_PUSH' },
        { pattern: /\(S\(.*?\)\)/i, provider: 'ISPORT', profile: 'PATH_SESSION' },
        { pattern: /GetOdds/i, provider: 'ISPORT', profile: 'PATH_SESSION' },
        { pattern: /Data/i, provider: 'SABA', profile: 'AUTO_PUSH' }
    ];

    private harvestedContracts: Map<string, SportsbookContract> = new Map();

    onModuleInit() {
        this.loadDynamicMappings();
        this.loadHarvestedContracts();
    }

    

    private loadDynamicMappings() {
        if (fs.existsSync(this.DYNAMIC_CONFIG_PATH)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.DYNAMIC_CONFIG_PATH, 'utf-8'));
                if (Array.isArray(data)) {
                    data.forEach(m => {
                        if (!this.mappings.some(existing => existing.provider === m.provider && existing.pattern.toString() === new RegExp(m.pattern, 'i').toString())) {
                            this.mappings.push({
                                pattern: new RegExp(m.pattern, 'i'),
                                provider: m.provider,
                                profile: m.profile
                            });
                            console.log(`[CONTRACT-REGISTRY] 📂 Loaded dynamic mapping: ${m.pattern} -> ${m.provider}`);
                        }
                    });
                }
            } catch (e) {
                console.error('[CONTRACT-REGISTRY] ❌ Failed to load dynamic contracts:', e);
            }
        }
    }

    private loadHarvestedContracts() {
        if (fs.existsSync(this.CONTRACT_STORAGE_PATH)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.CONTRACT_STORAGE_PATH, 'utf-8'));
                Object.keys(data).forEach(key => {
                    this.harvestedContracts.set(key, data[key]);
                });
                console.log(`[CONTRACT-REGISTRY] 📦 Loaded ${this.harvestedContracts.size} harvested contracts.`);
            } catch (e) {
                console.error('[CONTRACT-REGISTRY] ❌ Failed to load harvested contracts:', e);
            }
        }
    }

    public registerDynamicMapping(pattern: string, provider: string, profile: string = 'AUTO_PUSH') {
        const newMapping = { pattern: pattern, provider, profile };
        let existing = [];
        if (fs.existsSync(this.DYNAMIC_CONFIG_PATH)) {
            try { existing = JSON.parse(fs.readFileSync(this.DYNAMIC_CONFIG_PATH, 'utf-8')); } catch (e) { }
        }

        if (!existing.some(m => m.pattern === pattern)) {
            existing.push(newMapping);
            fs.writeFileSync(this.DYNAMIC_CONFIG_PATH, JSON.stringify(existing, null, 2));

            this.mappings.push({
                pattern: new RegExp(pattern, 'i'),
                provider,
                profile
            });
            console.log(`[CONTRACT-REGISTRY] ✅ Registered NEW dynamic mapping: ${pattern} -> ${provider}`);
            return true;
        }
        return false;
    }

    identify(url: string, payload?: any): { provider: string, profile: string } | null {
        for (const m of this.mappings) {
            if (m.pattern.test(url)) {
                return { provider: m.provider, profile: m.profile };
            }
        }
        if (payload && payload.d && payload.d.MatchList) return { provider: 'SABA', profile: 'AUTO_PUSH' };
        return null;
    }

    classifyData(data: any): string {
        if (!data) return 'UNKNOWN';
        if (Array.isArray(data)) return 'STREAM_ARRAY';
        if (data.pgBetOdds || data.SportItems || (data.d && data.d.MatchList)) return 'MATCH_LIST';
        if (data.BetType || data.odds) return 'ODDS_UPDATE';
        if (data.st === 'd' || data.isDelete || data.action === 'DELETE') return 'DELETE';
        return 'UNKNOWN';
    }

    recordMatchList(account: string, provider: string) { }

    getContract(id: string): SportsbookContract | null {
        // Support A:AFB88 or just AFB88
        return this.harvestedContracts.get(id) || null;
    }

    updateContract(account: string, provider: string, data: any) {
        const key = `${account}:${provider}`;
        const existing = this.harvestedContracts.get(key) || { provider, profile: 'DYNAMIC' };

        // 🛡️ v8.8: Deep merge headers to avoid overwriting tokens with empty objects
        const newHeaders = data.headers || {};
        const mergedHeaders = { ...(existing.headers || {}), ...newHeaders };

        const updated: SportsbookContract = {
            ...existing,
            ...data,
            headers: Object.keys(mergedHeaders).length > 0 ? mergedHeaders : existing.headers,
            lastUpdated: Date.now()
        };

        this.harvestedContracts.set(key, updated);
        this.saveHarvestedContracts();

        console.log(`[CONTRACT-REGISTRY] 💾 Updated contract for ${key}`);
    }

    private saveHarvestedContracts() {
        try {
            const data: any = {};
            this.harvestedContracts.forEach((val, key) => {
                data[key] = val;
            });
            fs.writeFileSync(this.CONTRACT_STORAGE_PATH, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('[CONTRACT-REGISTRY] ❌ Failed to save harvested contracts:', e);
        }
    }

    cleanAccount(account: string) {
        const keysToDelete = [];
        this.harvestedContracts.forEach((_, key) => {
            if (key.startsWith(`${account}:`)) keysToDelete.push(key);
        });
        keysToDelete.forEach(k => this.harvestedContracts.delete(k));
        this.saveHarvestedContracts();
    }

    hasFreshMatchList(account: string, provider?: string): boolean {
        return true;
    }
}
