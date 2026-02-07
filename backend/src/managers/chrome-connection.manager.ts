/**
 * ChromeConnectionManager v2.0 - SAFETY LOCK
 *
 * Injectable service for Chrome CDP connections with explicit state machine
 * Tracks connection state and prevents double attachments
 */

import { Injectable } from '@nestjs/common';

export type ChromeConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface ChromeConnectionInfo {
    port: number;
    state: ChromeConnectionState;
    tabs: number;
    lastChecked: number;
    attached: boolean; // Whether we're actively attached via CDP
    errorMessage?: string;
    attachedAt?: number;
}

@Injectable()
export class ChromeConnectionManager {
    // Track connection state per port (9222 for A, 9223 for B)
    private connectionStates: Map<number, ChromeConnectionInfo> = new Map();

    // Track active CDP attachments to prevent double attach
    private activeAttachments: Set<number> = new Set();

    // Global instance for exported functions
    private static globalInstance: ChromeConnectionManager | null = null;

    constructor() {
        // Initialize states for both accounts
        this.connectionStates.set(9222, {
            port: 9222,
            state: 'DISCONNECTED',
            tabs: 0,
            lastChecked: 0,
            attached: false
        });

        this.connectionStates.set(9223, {
            port: 9223,
            state: 'DISCONNECTED',
            tabs: 0,
            lastChecked: 0,
            attached: false
        });

        // Set as global instance if not set
        if (!ChromeConnectionManager.globalInstance) {
            ChromeConnectionManager.globalInstance = this;
        }
    }

    /**
     * Get global instance for exported functions
     */
    static getGlobalInstance(): ChromeConnectionManager | null {
        return ChromeConnectionManager.globalInstance;
    }

    /**
     * Check if Chrome is running on specified port
     */
    async checkConnection(port: number): Promise<boolean> {
        const currentState = this.connectionStates.get(port);
        if (currentState?.state === 'CONNECTING') {
            console.log(`[ChromeManager] ⏳ Already connecting to port ${port}, skipping check`);
            return false;
        }

        this.updateConnectionState(port, { state: 'CONNECTING' });

        try {
            const response = await fetch(`http://localhost:${port}/json/version`, {
                signal: AbortSignal.timeout(2000)
            });
            const isConnected = response.ok;
            this.updateConnectionState(port, {
                state: isConnected ? 'CONNECTED' : 'DISCONNECTED',
                lastChecked: Date.now()
            });
            return isConnected;
        } catch (error) {
            this.updateConnectionState(port, {
                state: 'ERROR',
                errorMessage: error.message,
                lastChecked: Date.now()
            });
            return false;
        }
    }

    /**
     * Get tabs count for port
     */
    async getTabsCount(port: number): Promise<number> {
        try {
            const response = await fetch(`http://localhost:${port}/json`);
            if (response.ok) {
                const tabs = await response.json();
                const count = tabs.filter((t: any) => t.type === 'page').length;
                this.updateConnectionState(port, { tabs: count });
                return count;
            }
        } catch {}
        this.updateConnectionState(port, { tabs: 0 });
        return 0;
    }

    /**
     * Attempt to attach to Chrome CDP on specified port
     * Returns false if already attached or in invalid state
     */
    async attachToChrome(port: number): Promise<boolean> {
        const currentState = this.connectionStates.get(port);
        console.log(`[ChromeManager] 🔗 Attempting to attach to Chrome on port ${port} (current state: ${currentState?.state})`);

        // Check if already attached
        if (this.activeAttachments.has(port)) {
            console.log(`[ChromeManager] 🚫 Already attached to Chrome on port ${port} - preventing double attach`);
            return false;
        }

        // Check if already in connecting state
        if (currentState?.state === 'CONNECTING') {
            console.log(`[ChromeManager] ⏳ Already connecting to port ${port}, waiting...`);
            return false;
        }

        // Set connecting state
        this.updateConnectionState(port, { state: 'CONNECTING' });

        try {
            // Verify Chrome is running
            const isConnected = await this.checkConnection(port);
            if (!isConnected) {
                console.log(`[ChromeManager] ❌ Chrome not running on port ${port}`);
                this.updateConnectionState(port, { state: 'DISCONNECTED' });
                return false;
            }

            // Mark as attached
            this.activeAttachments.add(port);
            this.updateConnectionState(port, {
                attached: true,
                attachedAt: Date.now(),
                state: 'CONNECTED'
            });

            console.log(`[ChromeManager] ✅ Successfully attached to Chrome on port ${port}`);
            return true;
        } catch (error) {
            console.error(`[ChromeManager] ❌ Failed to attach to Chrome on port ${port}:`, error);
            this.updateConnectionState(port, {
                state: 'ERROR',
                errorMessage: error.message
            });
            return false;
        }
    }

    /**
     * Detach from Chrome CDP on specified port
     */
    detachFromChrome(port: number): void {
        console.log(`[ChromeManager] 🔌 Detaching from Chrome on port ${port}`);

        this.activeAttachments.delete(port);
        this.updateConnectionState(port, {
            attached: false,
            attachedAt: undefined,
            state: 'DISCONNECTED'
        });
    }

    /**
     * Check if attached to Chrome on specified port
     */
    isAttached(port: number): boolean {
        return this.activeAttachments.has(port);
    }

    /**
     * Get connection state for port
     */
    getConnectionState(port: number): ChromeConnectionInfo | undefined {
        return this.connectionStates.get(port);
    }

    /**
     * Get all connection states
     */
    getAllConnectionStates(): Record<number, ChromeConnectionInfo> {
        return Object.fromEntries(this.connectionStates);
    }

    /**
     * Force detach all connections (for cleanup)
     */
    forceDetachAll(): void {
        console.log(`[ChromeManager] 🔄 Force detaching all Chrome connections`);
        this.activeAttachments.clear();

        for (const [port, state] of this.connectionStates) {
            this.updateConnectionState(port, {
                attached: false,
                attachedAt: undefined,
                state: 'DISCONNECTED'
            });
        }
    }

    /**
     * Update connection state for port
     */
    private updateConnectionState(port: number, updates: Partial<ChromeConnectionInfo>): void {
        const current = this.connectionStates.get(port);
        if (current) {
            this.connectionStates.set(port, { ...current, ...updates });
        }
    }

    /**
     * Get port for account
     */
    static getPortForAccount(account: 'A' | 'B'): number {
        return account === 'A' ? 9222 : 9223;
    }

    /**
     * Get account for port
     */
    static getAccountForPort(port: number): 'A' | 'B' | null {
        if (port === 9222) return 'A';
        if (port === 9223) return 'B';
        return null;
    }
}