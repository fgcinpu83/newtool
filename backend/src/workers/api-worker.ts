// 🔒 ARCHITECTURE GATE
// Governed by:
// - ARSITEKTUR_FINAL.md (Constitution)
// - provider_arsitek.md (Operational Law)
// Any logic here must map to a registered Provider Profile.
// Unauthorized behavior is an architectural violation.
// ============================================================

import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { PROVIDERS, ProviderDefinition } from '../shared/provider.architecture';

const WIRE_LOG = path.join(process.cwd(), 'wire_debug.log');

export interface RawDataEvent {
    provider: string; // 'A' or 'B'
    type: 'odds_batch' | 'match_batch' | 'balance' | 'error';
    data: any;
    receivedAt: number;
    actualProvider?: string;
}

export interface SessionData {
    cookies: string;
    userAgent: string;
    baseUrl: string;
    provider?: string;
}

export abstract class BaseApiWorker extends EventEmitter {
    protected logger: Logger;
    protected session: SessionData | null = null;
    protected isRunning = false;
    protected providerName: string;
    protected account: string;
    protected definition: ProviderDefinition;

    // Callbacks
    public onData: (event: RawDataEvent) => void = () => { };
    public onInvalid: (reason: string) => void = () => { };

    constructor(account: string, providerName: string) {
        super();
        this.account = account;
        this.providerName = providerName;
        this.definition = PROVIDERS[providerName] || PROVIDERS.GENERIC;
        this.logger = new Logger(`${providerName}-WORKER`);
        this.logger.log(`Worker initialized (PASSIVE v3.1)`);
    }

    public setSession(session: SessionData) {
        if (!session) return;
        this.session = session;
        this.logger.log(`Session context updated (UA/Cookies/BaseUrl)`);
    }

    public start() {
        this.isRunning = true;
        this.logger.log(`[WORKER-${this.account}] Worker active (Waiting for traffic)`);
    }

    public stop() {
        this.isRunning = false;
        this.logger.log(`[WORKER-${this.account}] Worker inactive`);
    }

    public emit(type: RawDataEvent['type'], data: any): boolean {
        const realIdentity = (this.session && this.session.provider) || this.providerName;

        this.onData({
            provider: this.account,
            actualProvider: realIdentity,
            type,
            data,
            receivedAt: Date.now()
        });

        // Telemetry
        if (type !== 'odds_batch' || Math.random() < 0.05) {
            const msg = `[WIRE-PASSIVE] [${this.account}/${realIdentity}] type=${type} dataSize=${Array.isArray(data) ? data.length : '1'}`;
            try { fs.appendFileSync(WIRE_LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
        }

        // Comply with EventEmitter signature
        return super.emit(type, data);
    }

    public ingestPassiveMonitor(contractData: any) {
        if (!contractData || !contractData.responseBody) return;

        // v3.1 Class-Based Filter
        const type = contractData.type || 'unknown';
        const isHeartbeat = this.definition.heartbeat?.some(h => type.includes(h));
        const isOdds = this.definition.oddsEndpoints?.some(o => type.includes(o));

        try {
            let parsedData: any;
            const body = contractData.responseBody;

            if (typeof body === 'object') {
                parsedData = body;
            } else {
                const sanitized = this.sanitizeBody(body);
                parsedData = JSON.parse(sanitized);
            }

            // v3.1 Pure Parser: No endpoint classification.
            // Just pass the parsed payload to the worker implementation.
            this.processPacket(parsedData);
        } catch (e) {
            // Silently drop
        }
    }

    protected processHeartbeat(obj: any) {
        // Balance extraction from heartbeat if needed
        const balance = obj.ba || obj.balance;
        if (balance !== undefined) {
            this.emit('balance', balance);
        }
    }

    private sanitizeBody(body: string): string {
        let sanitized = body;
        if (body.includes('[') || body.includes('{')) {
            const start = Math.min(
                body.indexOf('{') === -1 ? Infinity : body.indexOf('{'),
                body.indexOf('[') === -1 ? Infinity : body.indexOf('[')
            );
            const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
            if (start !== Infinity && end !== -1) {
                sanitized = body.substring(start, end + 1);
            }
        }
        return sanitized;
    }

    protected abstract processPacket(obj: any): void;
}

export class CmdWorker extends BaseApiWorker {
    constructor(account: string = 'B', providerName: string = 'CMD368') {
        super(account, providerName);
    }

    protected processPacket(obj: any) {
        if (!obj) return;

        // CMD/ISPORT Recursive Search (V3.1 Implementation)
        const scan = (target: any) => {
            if (!target || typeof target !== 'object') return;

            // Odds/Matches
            let items = [];
            if (target.Data && Array.isArray(target.Data)) items = target.Data;
            else if (target.SportItems && Array.isArray(target.SportItems)) items = target.SportItems;

            if (items.length > 0) {
                console.log(`[CMD-WORKER] odds batch detected (${items.length} items)`);
                this.emit('odds_batch', items);
            }

            // Balance
            let balance = target.ba || target.balance;
            if (!balance && target.db && Array.isArray(target.db) && target.db[0]) {
                const db = target.db[0];
                balance = db.Balance || db.Balance2 || db.Balance2D;
            }
            if (balance !== undefined) {
                console.log(`[CMD-WORKER] balance detected: ${balance}`);
                this.emit('balance', balance);
            }

            // Recurse
            if (Array.isArray(target)) {
                target.forEach(scan);
            } else {
                Object.values(target).forEach(val => {
                    if (val && typeof val === 'object') scan(val);
                });
            }
        };

        scan(obj);
    }
}
