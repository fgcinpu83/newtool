// 🔒 ARCHITECTURE GATE
// Governed by: ARSITEKTUR_FINAL.md
// Role: AFB88 Worker (Event-Driven Stream Processor)

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { parseAfbPacket } from './parsers/afb-parser';

@Injectable()
export class AfbWorker {
    private readonly REDIS_SIM_DIR = path.join(process.cwd(), 'redis_state');

    constructor() {
        if (!fs.existsSync(this.REDIS_SIM_DIR)) fs.mkdirSync(this.REDIS_SIM_DIR);
    }

    process(account: string, raw: any) {
        // 🛡️ v3.1 RULES: pgMain is heartbeat only.
        if (raw.pgMain || (typeof raw === 'object' && JSON.stringify(raw).includes('wfMain'))) {
            this.setHeartbeat(account, 'AFB88', 'HEARTBEAT');
            return;
        }

        // 🛡️ v3.1 RULES: pgBetOdds is substantive.
        if (raw.pgBetOdds || raw.odds_batch || Array.isArray(raw)) {
            console.log(`[AFB-WORKER] 🟢 LIVE Stream detected for Account ${account}`);
            const result = parseAfbPacket(raw);
            if (result.odds.length > 0) {
                this.syncToRedis(account, 'AFB88', result.odds);
            }
            if (result.balance !== null) {
                this.setBalance(account, 'AFB88', result.balance);
            }
        }
    }

    private setBalance(account: string, provider: string, balance: number) {
        const key = `${account}:${provider}`;
        fs.writeFileSync(path.join(this.REDIS_SIM_DIR, `${key}.balance`), JSON.stringify({
            balance,
            lastSeen: Date.now()
        }));
    }

    private setHeartbeat(account: string, provider: string, state: string) {
        const key = `${account}:${provider}`;
        fs.writeFileSync(path.join(this.REDIS_SIM_DIR, `${key}.status`), JSON.stringify({
            state,
            lastSeen: Date.now(),
            ttl: 3000
        }));
    }

    private syncToRedis(account: string, provider: string, data: any) {
        const key = `${account}:${provider}`;
        fs.writeFileSync(path.join(this.REDIS_SIM_DIR, `${key}.odds`), JSON.stringify({
            data,
            lastSeen: Date.now(),
            ttl: 3000,
            state: 'LIVE'
        }));
        this.setHeartbeat(account, provider, 'LIVE');
    }
}
