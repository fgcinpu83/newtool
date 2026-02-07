/**
 * ChromeConnectionManager v1.0
 *
 * Injectable service for Chrome CDP connections
 * Tracks connection state and prevents double attachments
 */

import { Injectable } from '@nestjs/common';

export interface ChromeConnectionState {
    port: number;
    connected: boolean;
    tabs: number;
    lastChecked: number;
    attached: boolean; // Whether we're actively attached via CDP
}

@Injectable()
export class ChromeConnectionManager {
    // Track connection state per port (9222 for A, 9223 for B)
    private connectionStates: Map<number, ChromeConnectionState> = new Map();

    // Track active CDP attachments to prevent double attach
    private activeAttachments: Set<number> = new Set();

    // Global instance for exported functions
    private static globalInstance: ChromeConnectionManager | null = null;

    constructor() {
        // Initialize states for both accounts
        this.connectionStates.set(9222, {
            port: 9222,
            connected: false,
            tabs: 0,
            lastChecked: 0,
            attached: false
        });

        this.connectionStates.set(9223, {
            port: 9223,
            connected: false,
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
        try {
            const response = await fetch(`http://localhost:${port}/json/version`, {
                signal: AbortSignal.timeout(2000)
            });
            const isConnected = response.ok;
            this.updateConnectionState(port, { connected: isConnected, lastChecked: Date.now() });
            return isConnected;
        } catch {
            this.updateConnectionState(port, { connected: false, lastChecked: Date.now() });
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
     * Returns false if already attached
     */
    async attachToChrome(port: number): Promise<boolean> {
        console.log(`[ChromeManager] 🔗 Attempting to attach to Chrome on port ${port}`);

        // Check if already attached
        if (this.activeAttachments.has(port)) {
            console.log(`[ChromeManager] 🚫 Already attached to Chrome on port ${port} - preventing double attach`);
            return false;
        }

        // Verify Chrome is running
        const isConnected = await this.checkConnection(port);
        if (!isConnected) {
            console.log(`[ChromeManager] ❌ Chrome not running on port ${port}`);
            return false;
        }

        // Mark as attached
        this.activeAttachments.add(port);
        this.updateConnectionState(port, { attached: true });

        console.log(`[ChromeManager] ✅ Successfully attached to Chrome on port ${port}`);
        return true;
    }

    /**
     * Detach from Chrome CDP on specified port
     */
    detachFromChrome(port: number): void {
        console.log(`[ChromeManager] 🔌 Detaching from Chrome on port ${port}`);

        this.activeAttachments.delete(port);
        this.updateConnectionState(port, { attached: false });
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
    getConnectionState(port: number): ChromeConnectionState | undefined {
        return this.connectionStates.get(port);
    }

    /**
     * Get all connection states
     */
    getAllConnectionStates(): Record<number, ChromeConnectionState> {
        return Object.fromEntries(this.connectionStates);
    }

    /**
     * Force detach all connections (for cleanup)
     */
    forceDetachAll(): void {
        console.log(`[ChromeManager] 🔄 Force detaching all Chrome connections`);
        this.activeAttachments.clear();

        for (const [port, state] of this.connectionStates) {
            this.updateConnectionState(port, { attached: false });
        }
    }

    /**
     * Update connection state for port
     */
    private updateConnectionState(port: number, updates: Partial<ChromeConnectionState>): void {
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