/**
 * ActiveTabManager v1.0 — CONSTITUTION §III.1 COMPLIANT (STEP 3.3)
 *
 * SINGLE SOURCE OF TRUTH untuk active tab per Chrome port.
 *
 * Backend selalu tahu tab mana yang "milik sistem".
 * Tidak ada command ke tab ambigu.
 *
 * State machine (per port):
 *   NO_TAB → SELECTING → ACTIVE → NO_TAB (via release)
 *                    ↘ ERROR  ↗
 *
 * Tab selection methods:
 *   1. URL whitelist (configurable) — selectByWhitelist()
 *   2. Explicit targetId            — selectByTargetId()
 *
 * Rules:
 *   1. HANYA satu active tab per port pada satu waktu
 *   2. Semua file HARUS tanya ActiveTabManager untuk tahu tab aktif
 *   3. Tidak boleh ada CDP command di module ini (itu CDPSessionManager)
 *   4. Tab discovery via ChromeConnectionManager.getTabs() ONLY
 *   5. Tidak mengubah CDPSessionManager, ChromeLauncher, ExecutionGuard
 *
 * INVARIANTS:
 *   - getActiveTab() returns null jika state !== ACTIVE
 *   - Tidak ada file lain boleh menentukan tab aktif
 *   - Jika Chrome disconnect → state auto-reset ke NO_TAB
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ChromeConnectionManager } from './chrome-connection.manager';

// ─── State Machine ───────────────────────────────────
export type ActiveTabState = 'NO_TAB' | 'SELECTING' | 'ACTIVE' | 'ERROR';

const ALLOWED_TRANSITIONS: Record<ActiveTabState, ActiveTabState[]> = {
    NO_TAB:    ['SELECTING'],
    SELECTING: ['ACTIVE', 'ERROR', 'NO_TAB'],
    ACTIVE:    ['NO_TAB', 'ERROR'],
    ERROR:     ['NO_TAB', 'SELECTING'],
};

// ─── Tab info (from Chrome /json) ────────────────────
export interface ChromeTabInfo {
    id: string;
    title: string;
    url: string;
    type: string;
    webSocketDebuggerUrl?: string;
}

// ─── Per-port active tab state ───────────────────────
export interface ActiveTabInfo {
    port: number;
    state: ActiveTabState;
    tab: ChromeTabInfo | null;
    selectedAt: number | null;
    selectionMethod: 'whitelist' | 'explicit' | null;
    errorMessage: string | null;
}

// ─── URL whitelist entry ─────────────────────────────
export interface UrlWhitelistEntry {
    /** Human-readable label (e.g. 'SABA', 'AFB88') */
    label: string;
    /** URL substring or regex pattern to match tabs against */
    pattern: string;
}

// ─── Default whitelist — configurable at runtime ─────
const DEFAULT_URL_WHITELIST: UrlWhitelistEntry[] = [
    // SABA / ISPORT domains
    { label: 'SABA',  pattern: 'qq188' },
    { label: 'SABA',  pattern: 'lvx' },
    { label: 'SABA',  pattern: 'aro' },
    { label: 'SABA',  pattern: 'msy' },
    { label: 'SABA',  pattern: 'mgf' },
    { label: 'SABA',  pattern: 'vpe' },
    { label: 'SABA',  pattern: 'processbet' },
    // AFB88 domains
    { label: 'AFB88', pattern: 'afb88' },
    { label: 'AFB88', pattern: 'afb1188' },
    { label: 'AFB88', pattern: 'mpo' },
];

@Injectable()
export class ActiveTabManager {
    private readonly logger = new Logger(ActiveTabManager.name);

    /** Per-port active tab state */
    private readonly tabs: Map<number, ActiveTabInfo> = new Map();

    /** Configurable URL whitelist */
    private whitelist: UrlWhitelistEntry[] = [...DEFAULT_URL_WHITELIST];

    constructor(
        @Inject(forwardRef(() => ChromeConnectionManager))
        private readonly chromeManager: ChromeConnectionManager,
    ) {
        for (const port of [9222, 9223]) {
            this.tabs.set(port, {
                port,
                state: 'NO_TAB',
                tab: null,
                selectedAt: null,
                selectionMethod: null,
                errorMessage: null,
            });
        }
        this.logger.log('ActiveTabManager v1.0 initialized (ports 9222, 9223)');
    }

    // ─── STATE MACHINE CORE ─────────────────────────

    /**
     * Transition state with validation.
     * THROWS if transition is illegal.
     */
    private transition(port: number, to: ActiveTabState, extra?: Partial<ActiveTabInfo>): void {
        const info = this.tabs.get(port);
        if (!info) throw new Error(`[ActiveTabManager] Unknown port: ${port}`);

        const from = info.state;
        if (from === to) return; // noop

        if (!ALLOWED_TRANSITIONS[from].includes(to)) {
            const msg = `[ActiveTabManager] Illegal transition ${from} → ${to} on port ${port}`;
            this.logger.error(msg);
            throw new Error(msg);
        }

        this.tabs.set(port, { ...info, ...extra, state: to });
        this.logger.log(`[${port}] Tab ${from} → ${to}`);
    }

    // ─── PUBLIC API: TAB SELECTION ──────────────────

    /**
     * Select active tab by URL whitelist match.
     *
     * Scans all page tabs on the port, picks FIRST match against whitelist.
     *
     * IDEMPOTENT:
     *   - SELECTING / ACTIVE → return current info (no-op)
     *   - NO_TAB / ERROR     → attempt selection
     *
     * PRECONDITION:
     *   - ChromeConnectionManager.state(port) === 'CONNECTED'
     */
    async selectByWhitelist(port: number): Promise<ActiveTabInfo> {
        const current = this.getInfo(port);

        // ── Idempotent: already selecting or has active tab ──
        if (current.state === 'SELECTING' || current.state === 'ACTIVE') {
            this.logger.log(`[${port}] selectByWhitelist() idempotent — already ${current.state}`);
            return current;
        }

        // ── Precondition: Chrome MUST be CONNECTED ──
        this.assertChromeConnected(port);

        // ── Transition: NO_TAB/ERROR → SELECTING ──
        this.transition(port, 'SELECTING');

        try {
            const tabs = await this.chromeManager.getTabs(port);

            if (tabs.length === 0) {
                this.transition(port, 'ERROR', {
                    tab: null,
                    errorMessage: 'No page tabs found',
                });
                return this.getInfo(port);
            }

            // Find first tab matching whitelist
            const matched = this.matchWhitelist(tabs);

            if (!matched) {
                this.transition(port, 'ERROR', {
                    tab: null,
                    errorMessage: `No tab matches whitelist (${tabs.length} tabs scanned)`,
                });
                return this.getInfo(port);
            }

            // ── SUCCESS: SELECTING → ACTIVE ──
            this.transition(port, 'ACTIVE', {
                tab: matched,
                selectedAt: Date.now(),
                selectionMethod: 'whitelist',
                errorMessage: null,
            });

            this.logger.log(`[${port}] Active tab selected: "${matched.title}" (${matched.url})`);
            return this.getInfo(port);

        } catch (err: any) {
            this.transition(port, 'ERROR', {
                tab: null,
                errorMessage: err.message,
            });
            return this.getInfo(port);
        }
    }

    /**
     * Select active tab by explicit Chrome target ID.
     *
     * IDEMPOTENT:
     *   - SELECTING / ACTIVE → return current info (no-op)
     *   - NO_TAB / ERROR     → attempt selection
     *
     * PRECONDITION:
     *   - ChromeConnectionManager.state(port) === 'CONNECTED'
     */
    async selectByTargetId(port: number, targetId: string): Promise<ActiveTabInfo> {
        const current = this.getInfo(port);

        // ── Idempotent ──
        if (current.state === 'SELECTING' || current.state === 'ACTIVE') {
            this.logger.log(`[${port}] selectByTargetId() idempotent — already ${current.state}`);
            return current;
        }

        // ── Precondition ──
        this.assertChromeConnected(port);

        // ── Transition ──
        this.transition(port, 'SELECTING');

        try {
            const tabs = await this.chromeManager.getTabs(port);
            const found = tabs.find(t => t.id === targetId) || null;

            if (!found) {
                this.transition(port, 'ERROR', {
                    tab: null,
                    errorMessage: `Tab with targetId "${targetId}" not found`,
                });
                return this.getInfo(port);
            }

            // ── SUCCESS ──
            this.transition(port, 'ACTIVE', {
                tab: found,
                selectedAt: Date.now(),
                selectionMethod: 'explicit',
                errorMessage: null,
            });

            this.logger.log(`[${port}] Active tab selected (explicit): "${found.title}" (${found.url})`);
            return this.getInfo(port);

        } catch (err: any) {
            this.transition(port, 'ERROR', {
                tab: null,
                errorMessage: err.message,
            });
            return this.getInfo(port);
        }
    }

    /**
     * Release the active tab. Resets to NO_TAB.
     *
     * ONLY valid from ACTIVE. Other states → no-op (log warning).
     */
    release(port: number): void {
        const info = this.tabs.get(port);
        if (!info) return;

        if (info.state !== 'ACTIVE') {
            this.logger.warn(`[${port}] release() called in state ${info.state} — ignoring`);
            return;
        }

        this.transition(port, 'NO_TAB', {
            tab: null,
            selectedAt: null,
            selectionMethod: null,
            errorMessage: null,
        });

        this.logger.log(`[${port}] Active tab released → NO_TAB`);
    }

    /**
     * Release all ports (shutdown cleanup).
     */
    releaseAll(): void {
        for (const port of this.tabs.keys()) {
            this.tabs.set(port, {
                port,
                state: 'NO_TAB',
                tab: null,
                selectedAt: null,
                selectionMethod: null,
                errorMessage: null,
            });
        }
        this.logger.log('All active tabs released');
    }

    /**
     * Force-refresh: release current tab and re-select by whitelist.
     * Useful after navigation or page reload.
     */
    async refresh(port: number): Promise<ActiveTabInfo> {
        // Force back to NO_TAB regardless of current state
        this.tabs.set(port, {
            port,
            state: 'NO_TAB',
            tab: null,
            selectedAt: null,
            selectionMethod: null,
            errorMessage: null,
        });
        this.logger.log(`[${port}] Force refresh → NO_TAB`);

        return this.selectByWhitelist(port);
    }

    // ─── PUBLIC API: WHITELIST CONFIG ───────────────

    /**
     * Replace the URL whitelist at runtime.
     * Does NOT affect currently active tabs — call refresh() after if needed.
     */
    setWhitelist(entries: UrlWhitelistEntry[]): void {
        this.whitelist = [...entries];
        this.logger.log(`Whitelist updated: ${entries.length} entries`);
    }

    /**
     * Add entries to the whitelist.
     */
    addToWhitelist(entries: UrlWhitelistEntry[]): void {
        this.whitelist.push(...entries);
        this.logger.log(`Whitelist extended: +${entries.length} (total: ${this.whitelist.length})`);
    }

    /**
     * Get current whitelist (copy).
     */
    getWhitelist(): UrlWhitelistEntry[] {
        return [...this.whitelist];
    }

    // ─── READ-ONLY QUERIES ──────────────────────────

    /** Get active tab info for port (copy). Throws if unknown port. */
    getInfo(port: number): ActiveTabInfo {
        const info = this.tabs.get(port);
        if (!info) throw new Error(`[ActiveTabManager] Unknown port: ${port}`);
        return { ...info, tab: info.tab ? { ...info.tab } : null };
    }

    /** Get active tab info for account. */
    getInfoForAccount(account: 'A' | 'B'): ActiveTabInfo {
        return this.getInfo(ActiveTabManager.portFor(account));
    }

    /** Get all tab states (copy). */
    getAllStates(): Record<number, ActiveTabInfo> {
        const result: Record<number, ActiveTabInfo> = {};
        for (const [port, info] of this.tabs) {
            result[port] = { ...info, tab: info.tab ? { ...info.tab } : null };
        }
        return result;
    }

    /**
     * Get the active tab for a port.
     * Returns null if state !== ACTIVE.
     * This is THE method other modules call to know which tab to target.
     */
    getActiveTab(port: number): ChromeTabInfo | null {
        const info = this.tabs.get(port);
        if (!info || info.state !== 'ACTIVE' || !info.tab) return null;
        return { ...info.tab };
    }

    /**
     * Get the active tab for an account.
     * Returns null if no active tab.
     */
    getActiveTabForAccount(account: 'A' | 'B'): ChromeTabInfo | null {
        return this.getActiveTab(ActiveTabManager.portFor(account));
    }

    /** Is there an active tab on this port? */
    hasActiveTab(port: number): boolean {
        return this.tabs.get(port)?.state === 'ACTIVE';
    }

    /** Is there an active tab for this account? */
    hasActiveTabForAccount(account: 'A' | 'B'): boolean {
        return this.hasActiveTab(ActiveTabManager.portFor(account));
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

    // ─── INTERNAL ───────────────────────────────────

    /** Assert Chrome is CONNECTED. Throws otherwise. */
    private assertChromeConnected(port: number): void {
        const chromeInfo = this.chromeManager.getInfo(port);
        if (chromeInfo.state !== 'CONNECTED') {
            const msg = `[ActiveTabManager] Chrome port ${port} is ${chromeInfo.state}, expected CONNECTED`;
            this.logger.error(msg);
            throw new Error(msg);
        }
    }

    /**
     * Match tabs against URL whitelist.
     * Returns FIRST matching tab, or null if none match.
     */
    private matchWhitelist(tabs: ChromeTabInfo[]): ChromeTabInfo | null {
        for (const tab of tabs) {
            for (const entry of this.whitelist) {
                if (tab.url.toLowerCase().includes(entry.pattern.toLowerCase())) {
                    this.logger.debug(
                        `Whitelist match: "${entry.label}" pattern="${entry.pattern}" → tab="${tab.title}" url="${tab.url}"`,
                    );
                    return tab;
                }
            }
        }
        return null;
    }
}
