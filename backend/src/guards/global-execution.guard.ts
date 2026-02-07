/**
 * Global Execution Guard v1.0 - SAFETY LOCK
 *
 * Central guard for all betting executions
 * Ensures system is in valid state before allowing bets
 */

import { Injectable, Logger } from '@nestjs/common';
import { ProviderSessionManager } from '../managers/provider-session.manager';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';

export interface ExecutionContext {
    account: 'A' | 'B';
    providerId: string;
    stake: number;
    odds: number;
}

export interface ExecutionResult {
    allowed: boolean;
    reason: string;
    context?: {
        providerReady: boolean;
        chromeConnected: boolean;
        systemReady: boolean;
    };
}

@Injectable()
export class GlobalExecutionGuard {
    private readonly logger = new Logger(GlobalExecutionGuard.name);

    constructor(
        private providerManager: ProviderSessionManager,
        private chromeManager: ChromeConnectionManager
    ) {}

    /**
     * Main execution guard - called before ANY bet execution
     * SAFETY LOCK: Ensures all conditions are met before allowing execution
     */
    async assertExecutable(context: ExecutionContext): Promise<ExecutionResult> {
        const { account, providerId, stake, odds } = context;

        this.logger.log(`[EXECUTION-GUARD] 🔍 Checking execution for ${account}:${providerId} stake:${stake} odds:${odds}`);

        // 1. Check provider readiness (via manager v2.0 — state machine)
        const providerState = this.providerManager.getProviderState(providerId);
        const providerReady = providerState?.state === 'READY';

        if (!providerReady) {
            const reason = `Provider ${providerId} not ready (state:${providerState?.state})`;
            this.logger.warn(`[EXECUTION-GUARD] 🚫 BLOCKED: ${reason}`);
            return {
                allowed: false,
                reason,
                context: {
                    providerReady: false,
                    chromeConnected: false,
                    systemReady: false
                }
            };
        }

        // 2. Check Chrome connection (via manager v3.0 API)
        const port = ChromeConnectionManager.portFor(account);
        const chromeState = this.chromeManager.getInfo(port);
        const chromeConnected = chromeState.state === 'CONNECTED';

        if (!chromeConnected) {
            const reason = `Chrome not connected for account ${account} (state:${chromeState.state})`;
            this.logger.warn(`[EXECUTION-GUARD] 🚫 BLOCKED: ${reason}`);
            return {
                allowed: false,
                reason,
                context: {
                    providerReady: true,
                    chromeConnected: false,
                    systemReady: false
                }
            };
        }

        // 3. Check system readiness
        const systemReady = this.providerManager.isSystemReady();

        if (!systemReady) {
            const reason = `System not ready - both accounts must have providers`;
            this.logger.warn(`[EXECUTION-GUARD] 🚫 BLOCKED: ${reason}`);
            return {
                allowed: false,
                reason,
                context: {
                    providerReady: true,
                    chromeConnected: true,
                    systemReady: false
                }
            };
        }

        // 4. Validate stake (basic sanity check)
        if (stake <= 0 || stake > 10000) {
            const reason = `Invalid stake amount: ${stake}`;
            this.logger.warn(`[EXECUTION-GUARD] 🚫 BLOCKED: ${reason}`);
            return {
                allowed: false,
                reason,
                context: {
                    providerReady: true,
                    chromeConnected: true,
                    systemReady: true
                }
            };
        }

        // 5. Validate odds (basic sanity check)
        if (odds < 1.01 || odds > 100) {
            const reason = `Invalid odds: ${odds}`;
            this.logger.warn(`[EXECUTION-GUARD] 🚫 BLOCKED: ${reason}`);
            return {
                allowed: false,
                reason,
                context: {
                    providerReady: true,
                    chromeConnected: true,
                    systemReady: true
                }
            };
        }

        this.logger.log(`[EXECUTION-GUARD] ✅ ALLOWED: All checks passed for ${account}:${providerId}`);
        return {
            allowed: true,
            reason: 'All safety checks passed',
            context: {
                providerReady: true,
                chromeConnected: true,
                systemReady: true
            }
        };
    }

    /**
     * Quick check for system readiness (for UI status)
     */
    isSystemReady(): boolean {
        return this.providerManager.isSystemReady();
    }

    /**
     * Get detailed system status
     */
    getSystemStatus() {
        const providerStates = this.providerManager.getAllProviderStates();
        const chromeStates = this.chromeManager.getAllStates();

        return {
            providers: providerStates,
            chrome: chromeStates,
            systemReady: this.isSystemReady()
        };
    }
}