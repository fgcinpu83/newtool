/**
 * ProviderSessionManager v1.0
 *
 * Injectable service for provider session states
 * Tracks login status, readiness, and balance per provider
 */

import { Injectable } from '@nestjs/common';

export type ProviderState = 'INACTIVE' | 'SESSION_BOUND' | 'LIVE' | 'IDLE' | 'RECOVERING' | 'DEAD' | 'HEARTBEAT_ONLY' | 'NO_DATA';

export interface ProviderSessionState {
    providerId: string; // e.g., 'A1', 'B2'
    state: ProviderState;
    loggedIn: boolean;
    ready: boolean;
    balance: string;
    lastUpdated: number;
    account: 'A' | 'B';
    providerType?: string; // e.g., 'AFB88', 'ISPORT'
    url?: string;
}

@Injectable()
export class ProviderSessionManager {
    // Track session state per provider slot
    private sessionStates: Map<string, ProviderSessionState> = new Map();

    // Track overall account readiness
    private accountReady: Record<'A' | 'B', boolean> = { A: false, B: false };

    constructor() {
        // Initialize all provider slots
        const slots = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5'];
        for (const slot of slots) {
            const account = slot.charAt(0) as 'A' | 'B';
            this.sessionStates.set(slot, {
                providerId: slot,
                state: 'INACTIVE',
                loggedIn: false,
                ready: false,
                balance: '0.00',
                lastUpdated: Date.now(),
                account
            });
        }
    }

    /**
     * Update provider session state
     */
    updateProviderState(providerId: string, updates: Partial<ProviderSessionState>): void {
        const current = this.sessionStates.get(providerId);
        if (!current) {
            console.warn(`[ProviderManager] ⚠️ Unknown provider: ${providerId}`);
            return;
        }

        const newState = { ...current, ...updates, lastUpdated: Date.now() };
        this.sessionStates.set(providerId, newState);

        console.log(`[ProviderManager] 📝 Updated ${providerId}: ${current.state} → ${newState.state}, loggedIn: ${newState.loggedIn}, ready: ${newState.ready}`);

        // Update account readiness based on provider states
        this.updateAccountReadiness(newState.account);
    }

    /**
     * Get provider session state
     */
    getProviderState(providerId: string): ProviderSessionState | undefined {
        return this.sessionStates.get(providerId);
    }

    /**
     * Get all provider states for an account
     */
    getAccountProviders(account: 'A' | 'B'): ProviderSessionState[] {
        return Array.from(this.sessionStates.values())
            .filter(state => state.account === account);
    }

    /**
     * Check if account has any ready providers
     */
    isAccountReady(account: 'A' | 'B'): boolean {
        return this.accountReady[account];
    }

    /**
     * Check if system is ready (both accounts have providers)
     */
    isSystemReady(): boolean {
        return this.accountReady.A && this.accountReady.B;
    }

    /**
     * Get providers that are ready for an account
     */
    getReadyProviders(account: 'A' | 'B'): ProviderSessionState[] {
        return this.getAccountProviders(account)
            .filter(provider => provider.ready && provider.loggedIn);
    }

    /**
     * Set provider as logged in
     */
    setProviderLoggedIn(providerId: string, loggedIn: boolean, providerType?: string, url?: string): void {
        this.updateProviderState(providerId, {
            loggedIn,
            state: loggedIn ? 'SESSION_BOUND' : 'INACTIVE',
            providerType,
            url
        });
    }

    /**
     * Set provider as ready
     */
    setProviderReady(providerId: string, ready: boolean): void {
        const newState: ProviderState = ready ? 'LIVE' : 'INACTIVE';
        this.updateProviderState(providerId, { ready, state: newState });
    }

    /**
     * Update provider balance
     */
    updateProviderBalance(providerId: string, balance: string): void {
        this.updateProviderState(providerId, { balance });
    }

    /**
     * Mark provider as dead/recovering
     */
    setProviderHealth(providerId: string, healthy: boolean): void {
        const state: ProviderState = healthy ? 'LIVE' : 'DEAD';
        this.updateProviderState(providerId, { state });
    }

    /**
     * Reset all providers for an account
     */
    resetAccountProviders(account: 'A' | 'B'): void {
        console.log(`[ProviderManager] 🔄 Resetting all providers for account ${account}`);

        for (const [providerId, state] of this.sessionStates) {
            if (state.account === account) {
                this.updateProviderState(providerId, {
                    state: 'INACTIVE',
                    loggedIn: false,
                    ready: false,
                    balance: '0.00'
                });
            }
        }
    }

    /**
     * Get system status summary
     */
    getSystemStatus(): {
        accounts: Record<'A' | 'B', {
            ready: boolean;
            providers: ProviderSessionState[];
            readyCount: number;
        }>;
        systemReady: boolean;
    } {
        const accounts = {
            A: {
                ready: this.accountReady.A,
                providers: this.getAccountProviders('A'),
                readyCount: this.getReadyProviders('A').length
            },
            B: {
                ready: this.accountReady.B,
                providers: this.getAccountProviders('B'),
                readyCount: this.getReadyProviders('B').length
            }
        };

        return {
            accounts,
            systemReady: this.isSystemReady()
        };
    }

    /**
     * Update account readiness based on provider states
     */
    private updateAccountReadiness(account: 'A' | 'B'): void {
        const readyProviders = this.getReadyProviders(account);
        const wasReady = this.accountReady[account];
        this.accountReady[account] = readyProviders.length > 0;

        if (wasReady !== this.accountReady[account]) {
            console.log(`[ProviderManager] 📊 Account ${account} readiness: ${wasReady} → ${this.accountReady[account]} (${readyProviders.length} ready providers)`);
        }
    }

    /**
     * Force reset all states (for system restart)
     */
    forceResetAll(): void {
        console.log(`[ProviderManager] 🔄 Force resetting all provider states`);

        for (const providerId of this.sessionStates.keys()) {
            this.updateProviderState(providerId, {
                state: 'INACTIVE',
                loggedIn: false,
                ready: false,
                balance: '0.00'
            });
        }
    }
}