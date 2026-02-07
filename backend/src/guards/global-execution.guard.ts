/**
 * Global Execution Guard v2.0 — CONSTITUTION §III.3 COMPLIANT
 *
 * SINGLE GATE for ALL betting execution.
 * assertExecutable() THROWS on failure — no boolean return.
 *
 * Checks (in order):
 *   1. Provider state === READY
 *   2. Chrome  state === CONNECTED
 *   3. System  state === READY (both accounts have READY providers)
 *
 * Jika salah satu gagal → THROW ExecutionBlockedError.
 * Tidak ada bypass.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ProviderSessionManager } from '../managers/provider-session.manager';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';

// ─── Minimal context — guard does NOT validate stake/odds (executor concern) ───
export interface ExecutionContext {
    account: 'A' | 'B';
    providerId: string;
}

// ─── Custom error thrown on ANY guard failure ──────────────────────────────────
export class ExecutionBlockedError extends Error {
    public readonly check: 'PROVIDER' | 'CHROME' | 'SYSTEM';
    public readonly detail: Record<string, unknown>;

    constructor(check: 'PROVIDER' | 'CHROME' | 'SYSTEM', reason: string, detail: Record<string, unknown> = {}) {
        super(reason);
        this.name = 'ExecutionBlockedError';
        this.check = check;
        this.detail = detail;
    }
}

@Injectable()
export class GlobalExecutionGuard {
    private readonly logger = new Logger(GlobalExecutionGuard.name);

    constructor(
        private providerManager: ProviderSessionManager,
        private chromeManager: ChromeConnectionManager,
    ) {}

    /**
     * SINGLE GATE — called before ANY bet execution.
     * Returns void on success.  THROWS ExecutionBlockedError on failure.
     */
    assertExecutable(context: ExecutionContext): void {
        const { account, providerId } = context;

        this.logger.log(`[GUARD] Checking ${account}:${providerId}`);

        // 1. Provider must be READY
        const providerState = this.providerManager.getProviderState(providerId);
        if (!providerState || providerState.state !== 'READY') {
            const reason = `Provider ${providerId} not READY (state: ${providerState?.state ?? 'UNKNOWN'})`;
            this.logger.warn(`[GUARD] BLOCKED — ${reason}`);
            throw new ExecutionBlockedError('PROVIDER', reason, {
                providerId,
                currentState: providerState?.state ?? 'UNKNOWN',
            });
        }

        // 2. Chrome must be CONNECTED for this account
        const port = ChromeConnectionManager.portFor(account);
        const chromeInfo = this.chromeManager.getInfo(port);
        if (chromeInfo.state !== 'CONNECTED') {
            const reason = `Chrome not CONNECTED for account ${account} (state: ${chromeInfo.state})`;
            this.logger.warn(`[GUARD] BLOCKED — ${reason}`);
            throw new ExecutionBlockedError('CHROME', reason, {
                account,
                port,
                currentState: chromeInfo.state,
            });
        }

        // 3. System must be READY (both accounts have READY providers)
        if (!this.providerManager.isSystemReady()) {
            const reason = 'System not READY — both accounts must have READY providers';
            this.logger.warn(`[GUARD] BLOCKED — ${reason}`);
            throw new ExecutionBlockedError('SYSTEM', reason, {
                systemStatus: this.providerManager.getSystemStatus(),
            });
        }

        this.logger.log(`[GUARD] ALLOWED ${account}:${providerId}`);
    }

    // ─── Read-only helpers (for UI / gateway status) ────────────────────────

    /** Quick boolean for dashboard readiness indicator */
    isSystemReady(): boolean {
        return this.providerManager.isSystemReady();
    }

    /** Detailed snapshot for status endpoints */
    getSystemStatus() {
        return {
            providers: this.providerManager.getAllProviderStates(),
            chrome: this.chromeManager.getAllStates(),
            systemReady: this.isSystemReady(),
        };
    }
}