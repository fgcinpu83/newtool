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
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';
import { WorkerService } from '../workers/worker.service';

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
        private worker: WorkerService,
        private chromeManager: ChromeConnectionManager,
    ) {}

    /**
     * SINGLE GATE — called before ANY bet execution.
     * Returns void on success.  THROWS ExecutionBlockedError on failure.
     */
    assertExecutable(context: ExecutionContext): void {
        const { account, providerId } = context;

        this.logger.log(`[GUARD] Checking ${account}:${providerId}`);

        // 1. Account-level provider must be marked (WorkerService is single source of truth)
        const acct = this.worker.accounts[account];
        if (!acct || !acct.providerMarked) {
            const reason = `Provider for account ${account} not marked`;
            this.logger.warn(`[GUARD] BLOCKED — ${reason}`);
            throw new ExecutionBlockedError('PROVIDER', reason, { account, providerId });
        }

        // 2. Chrome must be CONNECTED for this account
        const port = ChromeConnectionManager.portFor(account);
        const chromeInfo = this.chromeManager.getInfo(port);
        if (chromeInfo.state !== 'CONNECTED') {
            const reason = `Chrome not CONNECTED for account ${account} (state: ${chromeInfo.state})`;
            this.logger.warn(`[GUARD] BLOCKED — ${reason}`);
            throw new ExecutionBlockedError('CHROME', reason, { account, port, currentState: chromeInfo.state });
        }

        // 3. System must be READY per Constitution: both accounts must be ACTIVE
        if (!(this.worker.accounts.A.state === 'ACTIVE' && this.worker.accounts.B.state === 'ACTIVE')) {
            const reason = 'System not READY — both accounts must be ACTIVE';
            this.logger.warn(`[GUARD] BLOCKED — ${reason}`);
            throw new ExecutionBlockedError('SYSTEM', reason, { systemState: { A: this.worker.accounts.A.state, B: this.worker.accounts.B.state } });
        }

        this.logger.log(`[GUARD] ALLOWED ${account}:${providerId}`);
    }

    // ─── Read-only helpers (for UI / gateway status) ────────────────────────

    /** Quick boolean for dashboard readiness indicator (WorkerService authoritative) */
    isSystemReady(): boolean {
        return this.worker.accounts.A.state === 'ACTIVE' && this.worker.accounts.B.state === 'ACTIVE';
    }

    /** Detailed snapshot for status endpoints */
    getSystemStatus() {
        return {
            workers: this.worker.getState(),
            chrome: this.chromeManager.getAllStates(),
            systemReady: this.isSystemReady(),
        };
    }
}