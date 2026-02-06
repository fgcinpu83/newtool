// 🔒 ARCHITECTURE GATE
// Governed by: ARSITEKTUR_FINAL.md
// Role: CMD368/ISPORT Worker (Auto-Push Stream Processor)

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { parseSportsbookPacket } from './parsers/sportsbook-parser';

@Injectable()
export class CmdWorker {
    private readonly REDIS_SIM_DIR = path.join(process.cwd(), 'redis_state');

    constructor() {
        if (!fs.existsSync(this.REDIS_SIM_DIR)) fs.mkdirSync(this.REDIS_SIM_DIR);
    }

    process(account: string, raw: any) {
        if (!raw) return;

        // ISPORT/CMD usually sends substantive data directly or in MatchList
        console.log(`[CMD-WORKER] 🔵 Processing Account ${account} (ISPORT/SABA)`);

        const result = parseSportsbookPacket(raw);

        if (result.odds && result.odds.length > 0) {
            this.syncToRedis(account, 'ISPORT', result.odds);
        }

        if (result.balance !== null) {
            this.setBalance(account, 'ISPORT', result.balance);
        }
    }

    private setBalance(account: string, provider: string, balance: number) {
        const key = `${account}:${provider}`;
        fs.writeFileSync(path.join(this.REDIS_SIM_DIR, `${key}.balance`), JSON.stringify({
            balance,
            lastSeen: Date.now()
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

        // Update status for heartbeat
        fs.writeFileSync(path.join(this.REDIS_SIM_DIR, `${key}.status`), JSON.stringify({
            state: 'LIVE',
            lastSeen: Date.now(),
            ttl: 3000
        }));
    }
}

