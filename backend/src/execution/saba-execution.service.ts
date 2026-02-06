import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as qs from 'qs';
import { ContractRegistry } from '../workers/contract-registry.service';
import { RedisService } from '../shared/redis.service';

// 🛡️ v6.0 BETTING SAFETY GUARD - Slip Status Types
export interface SlipStatus {
    isValid: boolean;
    currentOdds: number | null;
    expectedOdds: number;
    oddsChanged: boolean;
    reason: string;
    timestamp: number;
}

export interface OddsVerification {
    matchId: string | number;
    oddsId: string | number;
    expectedOdds: number;
    tolerance?: number; // Optional tolerance for odds drift (default: 0)
}

@Injectable()
export class SabaExecutionService {
    private readonly logger = new Logger(SabaExecutionService.name);

    // 🛡️ v6.0 BETTING SAFETY GUARD - Default odds tolerance
    private readonly DEFAULT_ODDS_TOLERANCE = 0.00; // No tolerance by default - exact match required

    constructor(private readonly registry: ContractRegistry, private readonly redisService: RedisService) { }

    /**
     * 🛡️ v6.0 BETTING SAFETY GUARD - Check Slip Status
     * 
     * CRITICAL: This function MUST be called before clicking 'Place Bet'.
     * It verifies that the odds in the slip still match the scanner odds.
     * If odds have changed, the execution MUST be ABORTED.
     * 
     * @param verification - Object containing matchId, oddsId, expectedOdds
     * @returns SlipStatus with validation result
     */
    async checkSlipStatus(verification: OddsVerification): Promise<SlipStatus> {
        this.logger.log(`[SAFETY-GUARD] 🔍 Checking slip status for Match: ${verification.matchId}, Odds: ${verification.oddsId}`);

        const contract = this.registry.getContract('B:ISPORT');
        if (!contract || !contract.baseUrl) {
            return {
                isValid: false,
                currentOdds: null,
                expectedOdds: verification.expectedOdds,
                oddsChanged: false,
                reason: 'ABORT: No active session for SABA',
                timestamp: Date.now()
            };
        }

        try {
            // Build the odds check endpoint
            let baseUrl = contract.baseUrl;
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

            // SABA typically uses /GetOdds or /GetMatchOdds endpoint
            const endpoint = `${baseUrl}/Betting/GetOdds`;

            const payload = qs.stringify({
                Matchid: verification.matchId,
                Oddsid: verification.oddsId
            });

            this.logger.log(`[SAFETY-GUARD] 📡 Fetching current odds from: ${endpoint}`);

            const response = await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': contract.authorization || contract.headers?.['Authorization'] || (contract.headers?.['token'] ? `Bearer ${contract.headers['token']}` : ''),
                    'Cookie': contract.cookies || '',
                    'User-Agent': contract.userAgent || '',
                    ...contract.headers
                },
                timeout: 5000 // Short timeout for quick validation
            });

            const data = response.data;

            // Extract current odds from response
            // SABA API typically returns: { Odds: X.XX } or { DisplayOdds: X.XX } or { odds: X.XX }
            let currentOdds: number | null = null;
            if (data) {
                currentOdds = parseFloat(data.Odds) || parseFloat(data.DisplayOdds) ||
                    parseFloat(data.odds) || parseFloat(data.currentOdds) ||
                    parseFloat(data.OddsValue) || null;
            }

            if (currentOdds === null) {
                this.logger.warn(`[SAFETY-GUARD] ⚠️ Could not extract current odds from response`);
                return {
                    isValid: false,
                    currentOdds: null,
                    expectedOdds: verification.expectedOdds,
                    oddsChanged: false,
                    reason: 'ABORT: Unable to verify current odds',
                    timestamp: Date.now()
                };
            }

            // Compare odds with tolerance
            const tolerance = verification.tolerance ?? this.DEFAULT_ODDS_TOLERANCE;
            const oddsDrift = Math.abs(currentOdds - verification.expectedOdds);
            const oddsChanged = oddsDrift > tolerance;

            if (oddsChanged) {
                this.logger.error(`[SAFETY-GUARD] 🚨 ODDS CHANGED! Expected: ${verification.expectedOdds}, Current: ${currentOdds}, Drift: ${oddsDrift.toFixed(3)}`);
                return {
                    isValid: false,
                    currentOdds,
                    expectedOdds: verification.expectedOdds,
                    oddsChanged: true,
                    reason: `ABORT: Odds changed from ${verification.expectedOdds} to ${currentOdds} (drift: ${oddsDrift.toFixed(3)})`,
                    timestamp: Date.now()
                };
            }

            this.logger.log(`[SAFETY-GUARD] ✅ Odds verified: ${currentOdds} matches expected ${verification.expectedOdds}`);
            return {
                isValid: true,
                currentOdds,
                expectedOdds: verification.expectedOdds,
                oddsChanged: false,
                reason: 'VERIFIED: Odds match - safe to proceed',
                timestamp: Date.now()
            };

        } catch (error) {
            const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            this.logger.error(`[SAFETY-GUARD] ❌ Verification failed: ${msg}`);
            return {
                isValid: false,
                currentOdds: null,
                expectedOdds: verification.expectedOdds,
                oddsChanged: false,
                reason: `ABORT: Verification request failed - ${msg}`,
                timestamp: Date.now()
            };
        }
    }

    /**
     * 🛡️ v6.0 Safe Bet Execution with Pre-Verification
     * Wraps processBet with mandatory slip status check
     */
    async safePlaceBet(details: {
        Matchid: string | number;
        Oddsid: string | number;
        Odds: number | string;
        Stake: number;
        sinfo?: string;
        AcceptBetterOdds?: boolean;
    }): Promise<any> {
        // STEP 1: MANDATORY - Check slip status before placing bet
        const slipStatus = await this.checkSlipStatus({
            matchId: details.Matchid,
            oddsId: details.Oddsid,
            expectedOdds: parseFloat(String(details.Odds))
        });

        if (!slipStatus.isValid) {
            this.logger.error(`[SAFE-BET] 🛑 BET ABORTED: ${slipStatus.reason}`);
            return {
                Status: 'ABORTED',
                Reason: slipStatus.reason,
                SlipStatus: slipStatus
            };
        }

        // STEP 2: Proceed with bet only if verified
        this.logger.log(`[SAFE-BET] ✅ Slip verified. Proceeding with bet...`);
        return this.processBet(details);
    }

    /**
     * Sends a bet request to Saba (ISPORT) using x-www-form-urlencoded
     */
    async processBet(details: {
        Matchid: string | number;
        Oddsid: string | number;
        Odds: number | string;
        Stake: number;
        sinfo?: string;
        AcceptBetterOdds?: boolean;
    }): Promise<any> {
        // 1. Get Session from Registry
        const contract = this.registry.getContract('B:ISPORT');
        if (!contract || !contract.baseUrl) {
            this.logger.error('[SABA-EXEC] No active session for B:ISPORT found in Registry');
            throw new Error('MISSING_SESSION');
        }

        let sinfo = details.sinfo || contract.sinfo;
        if (!sinfo || sinfo === 'NONE') {
            // Try Redis fallback (short TTL key set by sniffer)
            try {
                const redisKey = `sinfo_B`;
                const stored = await this.redisService.get(redisKey);
                if (stored) sinfo = stored as any;
            } catch (e) { }
        }
        if (!sinfo || sinfo === 'NONE') {
            this.logger.warn('[SABA-EXEC] sinfo is missing. Bet might be rejected by Saba.');
        }

        // 2. Resolve Endpoint
        let baseUrl = contract.baseUrl;
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        const endpoint = `${baseUrl}/Betting/ProcessBet`;

        // 3. Map Payload
        const payload = {
            Matchid: details.Matchid,
            Oddsid: details.Oddsid,
            Odds: details.Odds,
            sinfo: sinfo || 'NONE',
            Stake: details.Stake,
            AcceptBetterOdds: details.AcceptBetterOdds ?? false
        };

        const formData = qs.stringify(payload);
        this.logger.log(`[SABA-EXEC] Sending ProcessBet to ${endpoint} (Stake: ${details.Stake}, sinfo: ${sinfo?.substring(0, 8)}...)`);

        try {
            const response = await axios.post(endpoint, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': contract.authorization || contract.headers?.['Authorization'] || (contract.headers?.['token'] ? `Bearer ${contract.headers['token']}` : ''),
                    'Cookie': contract.cookies || '',
                    'User-Agent': contract.userAgent || '',
                    ...contract.headers
                },
                timeout: 10000
            });

            // 4. Detailed Response Handling
            const data = response.data;
            const errCode = data.error_code ?? data.errorCode ?? data.status;

            if (errCode === 0 || data.Status === 'Success' || data.success === true) {
                this.logger.log(`[SABA-EXEC] ✅ SUCCESS: BetID=${data.betId || data.BetID || 'N/A'}`);
                return { ...data, Status: 'ACCEPTED' };
            }

            // Error Mapping (Based on Saba common patterns)
            let errorMessage = data.message || data.error_msg || 'Unknown error';
            let status = 'REJECTED';

            if (errCode === -2 || errorMessage.includes('odds')) status = 'ODDS_CHANGED';
            if (errCode === -5 || errorMessage.includes('balance')) status = 'INSUFFICIENT_BALANCE';
            if (errCode === -1 || errorMessage.includes('session')) status = 'SESSION_EXPIRED';

            this.logger.error(`[SABA-EXEC] ❌ ${status}: ${errorMessage} (Code: ${errCode})`);
            return { ...data, Status: status, ErrorMessage: errorMessage };

        } catch (error) {
            const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            this.logger.error(`[SABA-EXEC] 💥 NETWORK_ERROR: ${msg}`);
            return { Status: 'FAILED', ErrorMessage: msg };
        }
    }
}
