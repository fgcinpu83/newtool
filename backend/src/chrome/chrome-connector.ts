/**
 * ANTIGRAVITY - Chrome DevTools Protocol Connector
 * 
 * Connects to Chrome's Remote Debugging Port to:
 * 1. List all open tabs
 * 2. Attach to specific tabs for monitoring
 * 3. Execute scripts in page context
 * 4. Focus tabs for manual betting
 * 5. Open new tabs with URLs
 */

import WebSocket from 'ws';

interface ChromeTab {
    id: string;
    title: string;
    url: string;
    type: string;
    webSocketDebuggerUrl?: string;
}

interface CDPMessage {
    id: number;
    method?: string;
    params?: any;
    result?: any;
    error?: any;
}

export class ChromeConnector {
    private debugPort: number;
    private connections: Map<string, WebSocket> = new Map();
    private messageId: number = 1;

    constructor(debugPort: number = 9222) {
        this.debugPort = debugPort;
    }

    /**
     * Check if Chrome is reachable
     */
    async isConnected(): Promise<boolean> {
        try {
            const response = await fetch(`http://localhost:${this.debugPort}/json/version`, {
                signal: AbortSignal.timeout(2000)
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get list of all open tabs
     */
    async getTabs(): Promise<ChromeTab[]> {
        const response = await fetch(`http://localhost:${this.debugPort}/json`);
        const tabs = await response.json();
        return tabs.filter((t: ChromeTab) => t.type === 'page');
    }

    /**
     * Find tabs by URL pattern - checks domain match
     */
    async findTabsByUrl(pattern: string | RegExp): Promise<ChromeTab[]> {
        const tabs = await this.getTabs();
        return tabs.filter(tab => {
            if (typeof pattern === 'string') {
                // Extract domain from pattern
                try {
                    const patternDomain = new URL(pattern.startsWith('http') ? pattern : `https://${pattern}`).hostname;
                    const tabDomain = new URL(tab.url).hostname;
                    const match = tabDomain === patternDomain || tabDomain.endsWith(`.${patternDomain}`);
                    if (match) {
                        console.log(`[CDP] 🔍 Found existing tab for domain ${patternDomain}: ${tab.url}`);
                    }
                    return match;
                } catch {
                    return tab.url.includes(pattern);
                }
            }
            return pattern.test(tab.url);
        });
    }

    /**
     * Open a new tab with URL
     */
    async openNewTab(url: string): Promise<ChromeTab | null> {
        try {
            // Ensure URL has protocol
            let fullUrl = url;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                fullUrl = `https://${url}`;
            }

            // Use Chrome's endpoint to create new tab
            // Chrome CDP expects URL directly after /json/new?
            const endpoint = `http://localhost:${this.debugPort}/json/new?${fullUrl}`;
            console.log(`[CDP] Opening new tab: ${fullUrl}`);
            
            // Use PUT method (Chrome CDP standard)
            const response = await fetch(endpoint, {
                method: 'PUT',
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
                const tab = await response.json();
                console.log(`[CDP] ✅ Opened new tab: ${tab.id}`);
                return tab;
            }
            
            // Only try GET if PUT explicitly failed (not network error)
            if (response.status >= 400) {
                console.log(`[CDP] PUT returned ${response.status}, trying GET...`);
                const fallbackResponse = await fetch(endpoint, {
                    signal: AbortSignal.timeout(5000)
                });
                
                if (fallbackResponse.ok) {
                    const tab = await fallbackResponse.json();
                    console.log(`[CDP] ✅ Opened new tab (GET): ${tab.id}`);
                    return tab;
                }
            }
            
            console.error(`[CDP] Failed to open tab, status: ${response.status}`);
            return null;
        } catch (error) {
            console.error('[CDP] Failed to open new tab:', error);
            return null;
        }
    }

    /**
     * Connect to a specific tab via WebSocket
     */
    async connectToTab(tab: ChromeTab): Promise<WebSocket> {
        if (!tab.webSocketDebuggerUrl) {
            throw new Error(`Tab ${tab.id} has no WebSocket URL`);
        }

        if (this.connections.has(tab.id)) {
            return this.connections.get(tab.id)!;
        }

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(tab.webSocketDebuggerUrl!);
            
            ws.on('open', () => {
                console.log(`[CDP] Connected to tab: ${tab.title}`);
                this.connections.set(tab.id, ws);
                resolve(ws);
            });

            ws.on('error', (err) => {
                console.error(`[CDP] Connection error:`, err);
                reject(err);
            });

            ws.on('close', () => {
                console.log(`[CDP] Disconnected from tab: ${tab.title}`);
                this.connections.delete(tab.id);
            });
        });
    }

    /**
     * Send CDP command to tab
     */
    async sendCommand(ws: WebSocket, method: string, params: any = {}): Promise<any> {
        const id = this.messageId++;
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout waiting for response to ${method}`));
            }, 10000);

            const handler = (data: WebSocket.Data) => {
                const message: CDPMessage = JSON.parse(data.toString());
                if (message.id === id) {
                    clearTimeout(timeout);
                    ws.off('message', handler);
                    if (message.error) {
                        reject(new Error(message.error.message));
                    } else {
                        resolve(message.result);
                    }
                }
            };

            ws.on('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    /**
     * Focus a specific tab (bring to front)
     */
    async focusTab(tab: ChromeTab): Promise<void> {
        // Use the activate endpoint
        try {
            await fetch(`http://localhost:${this.debugPort}/json/activate/${tab.id}`);
            console.log(`[CDP] Focused tab: ${tab.title}`);
        } catch (error) {
            console.error(`[CDP] Failed to focus tab:`, error);
        }
    }

    /**
     * Execute JavaScript in page context
     */
    async executeScript(tab: ChromeTab, script: string): Promise<any> {
        const ws = await this.connectToTab(tab);
        const result = await this.sendCommand(ws, 'Runtime.evaluate', {
            expression: script,
            returnByValue: true,
            awaitPromise: true
        });
        return result.result?.value;
    }

    /**
     * Navigate existing tab to URL
     */
    async navigateTo(tab: ChromeTab, url: string): Promise<void> {
        const ws = await this.connectToTab(tab);
        await this.sendCommand(ws, 'Page.navigate', { url });
    }

    /**
     * Disconnect all connections
     */
    disconnect(): void {
        for (const [id, ws] of this.connections) {
            ws.close();
        }
        this.connections.clear();
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================
let connectorInstance: ChromeConnector | null = null;

export function getChromeConnector(): ChromeConnector {
    if (!connectorInstance) {
        connectorInstance = new ChromeConnector(9222);
    }
    return connectorInstance;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Global lock to prevent simultaneous opens for same account
const openingLocks = new Map<string, boolean>();
const recentOpens = new Map<string, number>(); // Track recent opens per domain

/**
 * Open URL in Chrome - Creates new tab or focuses existing
 * Includes mutex lock and deduplication
 */
export async function openUrlInChrome(url: string, account: 'A' | 'B'): Promise<{
    success: boolean;
    action: 'opened' | 'focused' | 'failed' | 'skipped';
    tabTitle?: string;
    error?: string;
}> {
    console.log(`[AUDIT-CONNECTOR] 🚀 openUrlInChrome CALLED: account=${account} url=${url}`);
    const connector = getChromeConnector();
    
    // Extract domain for deduplication
    let domain = url;
    try {
        domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    } catch {}
    
    const lockKey = `${account}:${domain}`;
    console.log(`[AUDIT-CONNECTOR] 🔑 lockKey=${lockKey} currentLocks=${[...openingLocks.keys()].join(',')}`);
    
    // Check if we're already opening for this account+domain
    if (openingLocks.get(lockKey)) {
        console.log(`[CDP] 🚫 Already opening ${domain} for Account ${account} - skipped`);
        return { success: true, action: 'skipped', tabTitle: 'In Progress' };
    }
    
    // Check if we recently opened (within 5 seconds)
    const lastOpen = recentOpens.get(lockKey) || 0;
    if (Date.now() - lastOpen < 5000) {
        console.log(`[CDP] 🚫 Recently opened ${domain} for Account ${account} (<5s ago) - skipped`);
        return { success: true, action: 'skipped', tabTitle: 'Recently Opened' };
    }
    
    // Set lock
    openingLocks.set(lockKey, true);
    
    try {
        // Check if Chrome is running
        const isConnected = await connector.isConnected();
        if (!isConnected) {
            return {
                success: false,
                action: 'failed',
                error: 'Chrome not running on port 9222. Run LAUNCH_CHROME.bat first.'
            };
        }

        // Check if tab with this URL already exists
        const existingTabs = await connector.findTabsByUrl(url);
        console.log(`[AUDIT-CONNECTOR] 🔍 Found ${existingTabs.length} existing tabs for ${domain}: ${existingTabs.map(t => t.url).join(', ')}`);
        
        if (existingTabs.length > 0) {
            // Focus existing tab
            console.log(`[CDP] 📍 Tab for ${domain} already exists, focusing... (NOT opening new!)`);
            await connector.focusTab(existingTabs[0]);
            recentOpens.set(lockKey, Date.now()); // Record time
            return {
                success: true,
                action: 'focused',
                tabTitle: existingTabs[0].title
            };
        }

        // Open new tab - ONLY IF NO EXISTING TAB
        console.log(`[AUDIT-CONNECTOR] 🆕 NO EXISTING TAB - Opening new tab for ${domain}...`);
        const newTab = await connector.openNewTab(url);
        
        if (newTab) {
            recentOpens.set(lockKey, Date.now()); // Record time
            return {
                success: true,
                action: 'opened',
                tabTitle: url
            };
        }

        return {
            success: false,
            action: 'failed',
            error: 'Failed to open new tab'
        };

    } catch (error: any) {
        console.error('[CDP] Error opening URL:', error);
        return {
            success: false,
            action: 'failed',
            error: error.message || 'Unknown error'
        };
    } finally {
        // Release lock
        openingLocks.set(lockKey, false);
    }
}

/**
 * Focus tab for specific account (for BET button)
 */
export async function focusAccountTab(urlPattern: string): Promise<{
    success: boolean;
    tabTitle?: string;
    error?: string;
}> {
    const connector = getChromeConnector();
    
    try {
        const tabs = await connector.findTabsByUrl(urlPattern);
        
        if (tabs.length === 0) {
            return {
                success: false,
                error: `No tab found matching: ${urlPattern}`
            };
        }

        await connector.focusTab(tabs[0]);
        
        return {
            success: true,
            tabTitle: tabs[0].title
        };
        
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to focus tab'
        };
    }
}

/**
 * Get Chrome connection status
 */
export async function checkChromeConnection(): Promise<{
    connected: boolean;
    tabs: number;
    error?: string;
}> {
    try {
        const connector = getChromeConnector();
        const isConnected = await connector.isConnected();
        
        if (!isConnected) {
            return {
                connected: false,
                tabs: 0,
                error: 'Chrome not reachable on port 9222'
            };
        }
        
        const tabs = await connector.getTabs();
        return {
            connected: true,
            tabs: tabs.length
        };
    } catch (error: any) {
        return {
            connected: false,
            tabs: 0,
            error: error.message || 'Chrome not reachable on port 9222'
        };
    }
}
