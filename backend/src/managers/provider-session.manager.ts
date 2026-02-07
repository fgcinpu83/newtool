/**
 * ProviderSessionManager v2.0 — CONSTITUTION COMPLIANT
 *
 * SYSTEM CONSTITUTION §III.2:
 * - Satu-satunya kebenaran provider
 * - State: INIT → LOGGED_IN → READY → ERROR
 * - Provider hanya MELAPOR event
 * - Manager yang MENENTUKAN status
 *
 * INVARIANTS:
 * 1. Provider CANNOT set itself READY — manager decides
 * 2. State transitions validated by ALLOWED_TRANSITIONS
 * 3. Only reportEvent() changes state — no direct setters
 * 4. One instance via @Global() ProviderModule
 */

import { Injectable, Logger } from '@nestjs/common';

// ─── State Machine ───────────────────────────────────
export type ProviderState = 'INIT' | 'LOGGED_IN' | 'READY' | 'ERROR';

const ALLOWED_TRANSITIONS: Record<ProviderState, ProviderState[]> = {
    INIT:      ['LOGGED_IN', 'ERROR'],
    LOGGED_IN: ['READY', 'ERROR', 'INIT'],
    READY:     ['LOGGED_IN', 'ERROR', 'INIT'],
    ERROR:     ['INIT'],
};

// ─── Provider Events (providers REPORT these) ────────
export type ProviderEvent =
    | 'SESSION_DETECTED'   // Chrome session/tab bound to provider
    | 'LOGIN_CONFIRMED'    // Provider page logged in (has session)
    | 'ODDS_RECEIVED'      // Live odds data flowing
    | 'BALANCE_RECEIVED'   // Balance data received
    | 'DATA_STALE'         // No data for threshold period
    | 'CONNECTION_LOST'    // Chrome/tab disconnected
    | 'ERROR'              // Unrecoverable error
    | 'RESET';             // Manual/system reset

// ─── Per-provider info ───────────────────────────────
export interface ProviderInfo {
    providerId: string;          // slot key: 'A1', 'B2', etc.
    state: ProviderState;
    account: 'A' | 'B';
    providerType: string;        // 'ISPORT', 'AFB88', 'SABA', etc.
    balance: string;
    lastEvent: ProviderEvent | null;
    lastEventTime: number;
    stateChangedAt: number;
    oddsReceivedCount: number;   // evidence counter for READY decision
    errorMessage?: string;
}

@Injectable()
export class ProviderSessionManager {
    private readonly logger = new Logger(ProviderSessionManager.name);

    // One entry per provider slot
    private readonly providers: Map<string, ProviderInfo> = new Map();

    constructor() {
        const slots = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5'];
        for (const slot of slots) {
            const account = slot.charAt(0) as 'A' | 'B';
            this.providers.set(slot, {
                providerId: slot,
                state: 'INIT',
                account,
                providerType: '',
                balance: '0.00',
                lastEvent: null,
                lastEventTime: 0,
                stateChangedAt: Date.now(),
                oddsReceivedCount: 0,
            });
        }
        this.logger.log('ProviderSessionManager v2.0 initialized (10 slots)');
    }

    // ─── STATE MACHINE CORE ─────────────────────────

    /**
     * Transition state with validation.
     * THROWS if transition is illegal.
     */
    private transition(providerId: string, to: ProviderState, extra?: Partial<ProviderInfo>): void {
        const info = this.providers.get(providerId);
        if (!info) throw new Error(`Unknown provider: ${providerId}`);

        const from = info.state;
        if (from === to) {
            // Noop — but still apply extra fields (balance, etc.)
            if (extra) {
                this.providers.set(providerId, { ...info, ...extra });
            }
            return;
        }

        if (!ALLOWED_TRANSITIONS[from].includes(to)) {
            const msg = `Illegal transition ${from} → ${to} for provider ${providerId}`;
            this.logger.error(msg);
            throw new Error(msg);
        }

        this.providers.set(providerId, {
            ...info,
            ...extra,
            state: to,
            stateChangedAt: Date.now(),
        });
        this.logger.log(`[${providerId}] ${from} → ${to}`);
    }

    // ─── PUBLIC API: EVENT REPORTING ─────────────────
    // Providers call this. Manager DECIDES the resulting state.

    /**
     * Report an event for a provider.
     * The MANAGER decides what state transition (if any) occurs.
     *
     * Constitution §III.2: Provider hanya MELAPOR, Manager yang MENENTUKAN.
     */
    reportEvent(
        providerId: string,
        event: ProviderEvent,
        meta?: { providerType?: string; balance?: string; errorMessage?: string },
    ): ProviderInfo {
        const info = this.providers.get(providerId);
        if (!info) {
            this.logger.warn(`reportEvent: unknown provider ${providerId}`);
            return this.getInfo(providerId);
        }

        const now = Date.now();
        const extra: Partial<ProviderInfo> = {
            lastEvent: event,
            lastEventTime: now,
        };
        if (meta?.providerType) extra.providerType = meta.providerType;
        if (meta?.balance) extra.balance = meta.balance;
        if (meta?.errorMessage) extra.errorMessage = meta.errorMessage;

        // ── MANAGER DECISION LOGIC ──────────────────
        switch (event) {
            case 'SESSION_DETECTED':
                // INIT → LOGGED_IN (session bound, not yet confirmed live)
                if (info.state === 'INIT') {
                    this.transition(providerId, 'LOGGED_IN', extra);
                } else {
                    this.applyExtra(providerId, extra);
                }
                break;

            case 'LOGIN_CONFIRMED':
                // INIT → LOGGED_IN
                if (info.state === 'INIT') {
                    this.transition(providerId, 'LOGGED_IN', extra);
                } else {
                    this.applyExtra(providerId, extra);
                }
                break;

            case 'ODDS_RECEIVED':
                // Increment evidence counter
                extra.oddsReceivedCount = (info.oddsReceivedCount || 0) + 1;
                extra.errorMessage = undefined; // clear previous error

                if (info.state === 'INIT') {
                    // Odds without explicit login → fast-track through LOGGED_IN to READY
                    this.transition(providerId, 'LOGGED_IN', extra);
                    this.transition(providerId, 'READY', extra);
                } else if (info.state === 'LOGGED_IN') {
                    // LOGGED_IN + odds = READY
                    this.transition(providerId, 'READY', extra);
                } else if (info.state === 'READY') {
                    // Already READY — just update counters
                    this.applyExtra(providerId, extra);
                } else if (info.state === 'ERROR') {
                    // ERROR + odds = recovery: INIT → LOGGED_IN → READY
                    this.transition(providerId, 'INIT', extra);
                    this.transition(providerId, 'LOGGED_IN', extra);
                    this.transition(providerId, 'READY', extra);
                }
                break;

            case 'BALANCE_RECEIVED':
                // Balance alone doesn't change state — just store
                this.applyExtra(providerId, extra);
                break;

            case 'DATA_STALE':
                // READY → LOGGED_IN (we know session exists, but data stopped)
                if (info.state === 'READY') {
                    this.transition(providerId, 'LOGGED_IN', {
                        ...extra,
                        oddsReceivedCount: 0,
                    });
                }
                break;

            case 'CONNECTION_LOST':
                // Any state → ERROR
                extra.errorMessage = meta?.errorMessage || 'Connection lost';
                if (info.state !== 'ERROR') {
                    try {
                        this.transition(providerId, 'ERROR', extra);
                    } catch {
                        // If transition not allowed, force via INIT
                        this.forceReset(providerId);
                    }
                }
                break;

            case 'ERROR':
                extra.errorMessage = meta?.errorMessage || 'Unknown error';
                if (info.state !== 'ERROR') {
                    try {
                        this.transition(providerId, 'ERROR', extra);
                    } catch {
                        this.forceReset(providerId);
                    }
                }
                break;

            case 'RESET':
                this.forceReset(providerId);
                break;

            default:
                this.logger.warn(`Unknown event: ${event} for ${providerId}`);
        }

        return this.getInfo(providerId);
    }

    // ─── READ-ONLY QUERIES (no side effects) ────────

    /** Get info for provider slot. */
    getInfo(providerId: string): ProviderInfo {
        const info = this.providers.get(providerId);
        if (!info) throw new Error(`Unknown provider: ${providerId}`);
        return { ...info }; // copy
    }

    /** Get provider state (backward compat alias). */
    getProviderState(providerId: string): ProviderInfo | undefined {
        const info = this.providers.get(providerId);
        return info ? { ...info } : undefined;
    }

    /** Get all providers for an account. */
    getAccountProviders(account: 'A' | 'B'): ProviderInfo[] {
        return Array.from(this.providers.values())
            .filter(p => p.account === account)
            .map(p => ({ ...p }));
    }

    /** Get all provider states (copy). */
    getAllProviderStates(): Record<string, ProviderInfo> {
        const result: Record<string, ProviderInfo> = {};
        for (const [id, info] of this.providers) {
            result[id] = { ...info };
        }
        return result;
    }

    /** Is the provider in READY state? */
    isProviderReady(providerId: string): boolean {
        return this.providers.get(providerId)?.state === 'READY';
    }

    /** Get READY providers for an account. */
    getReadyProviders(account: 'A' | 'B'): ProviderInfo[] {
        return this.getAccountProviders(account).filter(p => p.state === 'READY');
    }

    /** Does account have at least one READY provider? */
    isAccountReady(account: 'A' | 'B'): boolean {
        return this.getReadyProviders(account).length > 0;
    }

    /** Are both accounts READY? */
    isSystemReady(): boolean {
        return this.isAccountReady('A') && this.isAccountReady('B');
    }

    /** Full system status for dashboard/gateway. */
    getSystemStatus(): {
        accounts: Record<'A' | 'B', {
            ready: boolean;
            providers: ProviderInfo[];
            readyCount: number;
        }>;
        systemReady: boolean;
    } {
        return {
            accounts: {
                A: {
                    ready: this.isAccountReady('A'),
                    providers: this.getAccountProviders('A'),
                    readyCount: this.getReadyProviders('A').length,
                },
                B: {
                    ready: this.isAccountReady('B'),
                    providers: this.getAccountProviders('B'),
                    readyCount: this.getReadyProviders('B').length,
                },
            },
            systemReady: this.isSystemReady(),
        };
    }

    // ─── RESET OPERATIONS ───────────────────────────

    /** Force reset single provider to INIT. */
    forceReset(providerId: string): void {
        const info = this.providers.get(providerId);
        if (!info) return;

        this.providers.set(providerId, {
            ...info,
            state: 'INIT',
            providerType: '',
            balance: '0.00',
            lastEvent: 'RESET',
            lastEventTime: Date.now(),
            stateChangedAt: Date.now(),
            oddsReceivedCount: 0,
            errorMessage: undefined,
        });
        this.logger.log(`[${providerId}] force reset → INIT`);
    }

    /** Reset all providers for an account. */
    resetAccountProviders(account: 'A' | 'B'): void {
        this.logger.log(`Resetting all providers for account ${account}`);
        for (const [id, info] of this.providers) {
            if (info.account === account) {
                this.forceReset(id);
            }
        }
    }

    /** Reset ALL providers (emergency stop / restart). */
    forceResetAll(): void {
        this.logger.log('Force resetting ALL providers');
        for (const id of this.providers.keys()) {
            this.forceReset(id);
        }
    }

    // ─── INTERNAL ───────────────────────────────────

    /** Apply extra fields without state change. */
    private applyExtra(providerId: string, extra: Partial<ProviderInfo>): void {
        const info = this.providers.get(providerId);
        if (!info) return;
        this.providers.set(providerId, { ...info, ...extra });
    }
}
