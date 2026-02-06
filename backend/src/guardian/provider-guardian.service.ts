import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppGateway } from '../gateway.module';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '../shared/redis.service';
import { DiscoveryService } from '../discovery/discovery.service';

export type GuardianState = 'LIVE' | 'HEARTBEAT_ONLY' | 'SESSION_BOUND' | 'DEAD' | 'NO_DATA';

export interface ProviderHealth {
    account: string;
    provider: string;
    state: GuardianState;
    lastMatchTime: number;
    lastHeartbeatTime: number;
    lastBalanceTime: number;
    lastDataTime: number;
    matchesSeen: number;
    hasReceivedBalance: boolean;
    pageType: string;
    flapCount: number;
    lastInitTime: number;
    firstActiveAt?: number; // 🛰️ v3.2 Real-time Sync
}

@Injectable()
export class ProviderGuardianService implements OnModuleInit {
    private readonly logger = new Logger(ProviderGuardianService.name);
    private guardianStatus = new Map<string, ProviderHealth>();

    constructor(
        private gateway: AppGateway,
        private redis: RedisService,
        private discovery: DiscoveryService
    ) { }

    onModuleInit() {
        this.logger.log('🛡️ ProviderGuardianService STARTED - Enforcing Market Presence');
        // No auto-listener here, WorkerService will call updateStatus to ensure verifiedProvider is used.
    }

    private getOrCreate(account: string, provider: string): ProviderHealth {
        const key = `${account}:${provider}`;
        if (!this.guardianStatus.has(key)) {
            this.guardianStatus.set(key, {
                account,
                provider,
                state: 'NO_DATA',
                lastMatchTime: 0,
                lastHeartbeatTime: Date.now(),
                lastBalanceTime: 0,
                lastDataTime: Date.now(),
                matchesSeen: 0,
                hasReceivedBalance: false,
                pageType: 'unknown',
                flapCount: 0,
                lastInitTime: 0
            });
        }
        return this.guardianStatus.get(key)!;
    }

    public updateStatus(account: string, provider: string, type: string, matchCount: number = 0) {
        if (!account || !provider) return;
        const entry = this.getOrCreate(account, provider);
        const now = Date.now();
        entry.lastDataTime = now;

        // 🛰️ v3.2: First Active Marker
        if (!entry.firstActiveAt && (matchCount > 0 || ['balance', 'init', 'session_capture'].includes(type))) {
            entry.firstActiveAt = now;
            this.logger.log(`[STATUS_SYNC] ${account}/${provider} | Stream: INITIALIZED | Grace: 60s`);
        }

        // HEARTBEAT
        if (type === 'heartbeat') {
            entry.lastHeartbeatTime = now;
            if (entry.state === 'NO_DATA') {
                entry.state = 'HEARTBEAT_ONLY';
            }
        }
        // BALANCE / INIT / SESSION_CAPTURE / CONTRACT -> HEARTBEAT_ONLY
        // 🔒 v3.1 FIX: Type sudah dinormalisasi ke lowercase di WorkerService
        else if (['balance', 'init', 'session_capture', 'api_contract_capture', 'api_contract_recorder'].includes(type)) {
            entry.lastBalanceTime = now;
            entry.lastHeartbeatTime = now;
            entry.hasReceivedBalance = true;

            const sinceLastInit = now - (entry.lastInitTime || 0);
            if (sinceLastInit < 45000) {
                entry.flapCount = (entry.flapCount || 0) + 1;
            } else {
                if (entry.flapCount > 0) entry.flapCount--;
            }
            entry.lastInitTime = now;

            if (entry.state === 'NO_DATA' || entry.state === 'DEAD') {
                entry.state = 'HEARTBEAT_ONLY';
            }
        }
        // MATCH DATA -> LIVE
        else if (['odds', 'odds_batch', 'odds_update', 'match_batch'].includes(type)) {
            if (matchCount > 0) {
                entry.lastMatchTime = now;
                entry.matchesSeen += matchCount;
                entry.flapCount = 0;

                if (entry.state !== 'LIVE') {
                    entry.state = 'LIVE';
                    this.logger.log(`[GUARDIAN-DATA] ${account}/${provider} odds resumed (${matchCount} matches) -> LIVE`);
                }
            } else {
                entry.lastHeartbeatTime = now;
            }
        }
    }

    public getStatus(account: string, provider: string): ProviderHealth | null {
        return this.guardianStatus.get(`${account}:${provider}`) || null;
    }

    public getAllStatus(): Map<string, ProviderHealth> {
        return this.guardianStatus;
    }

    public cleanAccountRegistry(account: string) {
        const prefix = `${account}:`;
        for (const key of this.guardianStatus.keys()) {
            if (key.startsWith(prefix)) {
                this.guardianStatus.delete(key);
            }
        }
    }

    @Cron(CronExpression.EVERY_10_SECONDS)
    checkGuardian() {
        const now = Date.now();
        for (const [key, entry] of this.guardianStatus.entries()) {
            const sinceLastData = now - entry.lastDataTime;
            const sinceLastMatch = now - entry.lastMatchTime;
            const streamAge = now - (entry.firstActiveAt || 0);

            // 🛡️ v3.2 Grace Period: Prevent premature STALE/DEAD during first 60s
            const inGracePeriod = entry.firstActiveAt && streamAge < 60000;

            if (sinceLastData > 300000 && entry.state !== 'DEAD' && !inGracePeriod) {
                entry.state = 'DEAD';
                this.logger.error(`[GUARDIAN-DEAD] ${key} - 5m No Traffic`);
                // 🛡️ v3.2 SESSION RECOVERY: Emit refresh signal to frontend
                this.gateway.sendUpdate('session:stale', {
                    account: entry.account,
                    provider: entry.provider,
                    reason: 'DEAD',
                    action: 'REFRESH_REQUIRED',
                    lastMatch: entry.lastMatchTime
                });
            }
            else if (sinceLastMatch > 120000 && entry.state === 'LIVE' && !inGracePeriod) {
                entry.state = 'HEARTBEAT_ONLY';
                this.logger.warn(`[GUARDIAN-STARVED] ${key} - 2m No Odds Flow`);
                // 🛡️ v3.2 SESSION RECOVERY: Emit refresh signal to frontend
                this.gateway.sendUpdate('session:stale', {
                    account: entry.account,
                    provider: entry.provider,
                    reason: 'STARVED',
                    action: 'KEEPALIVE_REQUIRED'
                });
            }
        }
    }
}
