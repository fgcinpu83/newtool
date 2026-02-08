/**
 * ChromeConnectionManager v3.1 - CONSTITUTION COMPLIANT
 *
 * SYSTEM CONSTITUTION §III.1:
 * - Satu-satunya pintu Chrome
 * - State machine: DISCONNECTED → CONNECTING → CONNECTED / ERROR
 * - attach() idempotent
 * - Tidak boleh attach jika CONNECTING/CONNECTED
 * - Semua file chrome dilarang buat koneksi sendiri
 *
 * v3.1: attach() now calls ChromeLauncher.ensureRunning() BEFORE
 *       probing CDP — Chrome is started automatically if not running.
 *
 * INVARIANTS:
 * 1. State NEVER goes backwards without explicit detach()
 * 2. Only ONE attach per port at any time
 * 3. All Chrome HTTP/WS access MUST go through this manager
 * 4. ChromeLauncher is the ONLY way Chrome processes are spawned
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ChromeLauncher } from '../chrome/chrome-launcher.service';

// ─── State Machine ───────────────────────────────────
export type ChromeConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

// Allowed transitions (from → to[])
const ALLOWED_TRANSITIONS: Record<ChromeConnectionState, ChromeConnectionState[]> = {
    DISCONNECTED: ['CONNECTING'],
    CONNECTING:   ['CONNECTED', 'ERROR', 'DISCONNECTED'],
    CONNECTED:    ['DISCONNECTED', 'ERROR'],
    ERROR:        ['DISCONNECTED', 'CONNECTING'],
};

// ─── Per-port info ───────────────────────────────────
export interface ChromeConnectionInfo {
    port: number;
    state: ChromeConnectionState;
    tabs: number;
    lastChecked: number;
    errorMessage?: string;
    attachedAt?: number;
}

@Injectable()
export class ChromeConnectionManager {
    private readonly logger = new Logger(ChromeConnectionManager.name);

    // One entry per account port
    private readonly ports: Map<number, ChromeConnectionInfo> = new Map();

    constructor(
        @Inject(forwardRef(() => ChromeLauncher))
        private readonly launcher: ChromeLauncher,
    ) {
        for (const port of [9222, 9223]) {
            this.ports.set(port, {
                port,
                state: 'DISCONNECTED',
                tabs: 0,
                lastChecked: 0,
            });
        }
        this.logger.log('ChromeConnectionManager v3.1 initialized (ports 9222, 9223)');
    }

    // ─── STATE MACHINE CORE ─────────────────────────

    /**
     * Transition state with validation.
     * THROWS if transition is illegal.
     */
    private transition(port: number, to: ChromeConnectionState, extra?: Partial<ChromeConnectionInfo>): void {
        const info = this.ports.get(port);
        if (!info) throw new Error(`Unknown port: ${port}`);

        const from = info.state;
        if (from === to) return; // noop

        if (!ALLOWED_TRANSITIONS[from].includes(to)) {
            const msg = `Illegal transition ${from} → ${to} on port ${port}`;
            this.logger.error(msg);
            throw new Error(msg);
        }

        this.ports.set(port, { ...info, ...extra, state: to });
        this.logger.log(`[${port}] ${from} → ${to}`);
    }

    // ─── PUBLIC API ─────────────────────────────────

    /**
     * Attach to Chrome CDP on specified port.
     *
     * IDEMPOTENT per Constitution §III.1:
     * - CONNECTING / CONNECTED → return current state (no-op)
     * - DISCONNECTED / ERROR   → attempt connection
     */
    async attach(port: number): Promise<ChromeConnectionInfo> {
        const info = this.getInfo(port);

        // Idempotent: already connected or connecting → return
        if (info.state === 'CONNECTED' || info.state === 'CONNECTING') {
            this.logger.log(`[${port}] attach() idempotent — already ${info.state}`);
            this.logger.log(`[OBSERVE] Chrome connection stable - port ${port} already ${info.state}`);
            return info;
        }

        // Transition: DISCONNECTED/ERROR → CONNECTING
        this.transition(port, 'CONNECTING');
        this.logger.log(`[OBSERVE] Chrome connection attempt - port ${port} transitioning to CONNECTING`);

        try {
            // STEP 3.1: Ensure Chrome process is running before probing CDP
            const launchResult = await this.launcher.ensureRunning(port);
            if (!launchResult.launched && !launchResult.reused) {
                throw new Error(`Chrome launch failed: ${launchResult.message}`);
            }

            const response = await fetch(`http://localhost:${port}/json/version`, {
                signal: AbortSignal.timeout(3000),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Count tabs
            const tabs = await this.fetchTabCount(port);

            this.transition(port, 'CONNECTED', {
                tabs,
                lastChecked: Date.now(),
                attachedAt: Date.now(),
                errorMessage: undefined,
            });

            this.logger.log(`[OBSERVE] Chrome connection successful - port ${port} connected with ${tabs} tabs`);
            return this.getInfo(port);
        } catch (err: any) {
            this.transition(port, 'ERROR', {
                errorMessage: err.message,
                lastChecked: Date.now(),
                attachedAt: undefined,
            });
            this.logger.log(`[OBSERVE] Chrome connection failed - port ${port} error: ${err.message}`);
            return this.getInfo(port);
        }
    }

    /**
     * Detach from Chrome on specified port.
     * Always resets to DISCONNECTED regardless of current state.
     */
    detach(port: number): void {
        const info = this.ports.get(port);
        if (!info) return;

        // Force reset to clean DISCONNECTED
        this.ports.set(port, {
            port,
            state: 'DISCONNECTED',
            tabs: 0,
            lastChecked: Date.now(),
            errorMessage: undefined,
            attachedAt: undefined,
        });
        this.logger.log(`[${port}] detached → DISCONNECTED`);
    }

    /**
     * Detach all ports (shutdown cleanup).
     */
    detachAll(): void {
        for (const port of this.ports.keys()) {
            this.detach(port);
        }
    }

    // ─── READ-ONLY QUERIES (no side effects) ────────

    /** Get state for port. Throws if unknown port. */
    getInfo(port: number): ChromeConnectionInfo {
        const info = this.ports.get(port);
        if (!info) throw new Error(`Unknown port: ${port}`);
        return { ...info }; // return copy
    }

    /** Get state for account. */
    getInfoForAccount(account: 'A' | 'B'): ChromeConnectionInfo {
        return this.getInfo(ChromeConnectionManager.portFor(account));
    }

    /** Get all connection states (copy). */
    getAllStates(): Record<number, ChromeConnectionInfo> {
        const result: Record<number, ChromeConnectionInfo> = {};
        for (const [port, info] of this.ports) {
            result[port] = { ...info };
        }
        return result;
    }

    /** Is the port in CONNECTED state? */
    isConnected(port: number): boolean {
        return this.ports.get(port)?.state === 'CONNECTED';
    }

    /** Is the port in CONNECTED state for account? */
    isAccountConnected(account: 'A' | 'B'): boolean {
        return this.isConnected(ChromeConnectionManager.portFor(account));
    }

    // ─── CHROME HTTP HELPERS (delegated access) ─────
    // All chrome HTTP calls go through here so no other file touches Chrome directly.

    /** Fetch list of page tabs from Chrome. Requires CONNECTED state. */
    async getTabs(port: number): Promise<{ id: string; title: string; url: string; type: string; webSocketDebuggerUrl?: string }[]> {
        this.assertConnected(port);
        try {
            const res = await fetch(`http://localhost:${port}/json`, { signal: AbortSignal.timeout(3000) });
            if (!res.ok) return [];
            const all = await res.json();
            const pages = all.filter((t: any) => t.type === 'page');
            // Update tab count
            const info = this.ports.get(port)!;
            this.ports.set(port, { ...info, tabs: pages.length, lastChecked: Date.now() });
            return pages;
        } catch {
            return [];
        }
    }

    /** Open a new tab. Requires CONNECTED state. */
    async openTab(port: number, url: string): Promise<any | null> {
        this.assertConnected(port);
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        try {
            const endpoint = `http://localhost:${port}/json/new?${fullUrl}`;
            let res = await fetch(endpoint, { method: 'PUT', signal: AbortSignal.timeout(5000) });
            if (!res.ok) {
                res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
            }
            if (res.ok) return await res.json();
            return null;
        } catch {
            return null;
        }
    }

    /** Focus (activate) a tab by id. Requires CONNECTED state. */
    async focusTab(port: number, tabId: string): Promise<boolean> {
        this.assertConnected(port);
        try {
            await fetch(`http://localhost:${port}/json/activate/${tabId}`);
            return true;
        } catch {
            return false;
        }
    }

    // ─── STATIC HELPERS ─────────────────────────────

    static portFor(account: 'A' | 'B'): number {
        return account === 'A' ? 9222 : 9223;
    }

    static accountFor(port: number): 'A' | 'B' | null {
        if (port === 9222) return 'A';
        if (port === 9223) return 'B';
        return null;
    }

    // Backward compat aliases
    static getPortForAccount(account: 'A' | 'B'): number { return ChromeConnectionManager.portFor(account); }
    static getAccountForPort(port: number): 'A' | 'B' | null { return ChromeConnectionManager.accountFor(port); }

    // ─── INTERNAL ───────────────────────────────────

    private assertConnected(port: number): void {
        const state = this.ports.get(port)?.state;
        if (state !== 'CONNECTED') {
            throw new Error(`Chrome port ${port} is ${state}, expected CONNECTED`);
        }
    }

    private async fetchTabCount(port: number): Promise<number> {
        try {
            const res = await fetch(`http://localhost:${port}/json`, { signal: AbortSignal.timeout(2000) });
            if (!res.ok) return 0;
            const tabs = await res.json();
            return tabs.filter((t: any) => t.type === 'page').length;
        } catch {
            return 0;
        }
    }
}
