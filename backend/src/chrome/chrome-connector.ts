/**
 * ChromeConnector v3.0 - CONSTITUTION COMPLIANT
 *
 * SYSTEM CONSTITUTION §III.1:
 * - DILARANG membuat koneksi CDP langsung
 * - HARUS memanggil ChromeConnectionManager untuk semua Chrome HTTP
 *
 * This file is a THIN WRAPPER around ChromeConnectionManager.
 * It only manages WebSocket connections for CDP commands (script execution, navigation).
 * All HTTP calls (tabs, open, focus, status) go through the manager.
 */

import WebSocket from 'ws';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';

interface CDPMessage {
    id: number;
    method?: string;
    params?: any;
    result?: any;
    error?: any;
}

export interface ChromeTab {
    id: string;
    title: string;
    url: string;
    type: string;
    webSocketDebuggerUrl?: string;
}

export class ChromeConnector {
    private readonly port: number;
    private readonly manager: ChromeConnectionManager;
    private connections: Map<string, WebSocket> = new Map();
    private messageId: number = 1;

    constructor(port: number, manager: ChromeConnectionManager) {
        this.port = port;
        this.manager = manager;
    }

    // ─── DELEGATED TO MANAGER (no direct HTTP) ──────

    /** Check if Chrome is reachable — delegates to manager.attach() */
    async ensureConnected(): Promise<boolean> {
        const info = await this.manager.attach(this.port);
        return info.state === 'CONNECTED';
    }

    /** Get list of page tabs — delegates to manager */
    async getTabs(): Promise<ChromeTab[]> {
        return await this.manager.getTabs(this.port);
    }

    /** Find tabs by URL pattern */
    async findTabsByUrl(pattern: string | RegExp): Promise<ChromeTab[]> {
        const tabs = await this.getTabs();
        return tabs.filter(tab => {
            if (typeof pattern === 'string') {
                try {
                    const patternDomain = new URL(pattern.startsWith('http') ? pattern : `https://${pattern}`).hostname;
                    const tabDomain = new URL(tab.url).hostname;
                    return tabDomain === patternDomain || tabDomain.endsWith(`.${patternDomain}`);
                } catch {
                    return tab.url.includes(pattern);
                }
            }
            return pattern.test(tab.url);
        });
    }

    /** Open a new tab — delegates to manager */
    async openNewTab(url: string): Promise<ChromeTab | null> {
        return await this.manager.openTab(this.port, url);
    }

    /** Focus a tab — delegates to manager */
    async focusTab(tab: ChromeTab): Promise<void> {
        await this.manager.focusTab(this.port, tab.id);
    }

    // ─── WEBSOCKET CDP COMMANDS (only WS here) ──────

    /** Connect to a specific tab via WebSocket for CDP commands */
    async connectToTab(tab: ChromeTab): Promise<WebSocket> {
        if (!tab.webSocketDebuggerUrl) {
            throw new Error(`Tab ${tab.id} has no WebSocket URL`);
        }

        // Re-use existing connection
        if (this.connections.has(tab.id)) {
            return this.connections.get(tab.id)!;
        }

        // Manager must be CONNECTED before we open a WS
        if (!this.manager.isConnected(this.port)) {
            throw new Error(`ChromeConnectionManager not CONNECTED on port ${this.port}`);
        }

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(tab.webSocketDebuggerUrl!);

            ws.on('open', () => {
                console.log(`[ChromeConnector] WS connected to tab: ${tab.title}`);
                this.connections.set(tab.id, ws);
                resolve(ws);
            });

            ws.on('error', (err) => {
                console.error(`[ChromeConnector] WS error:`, err);
                reject(err);
            });

            ws.on('close', () => {
                this.connections.delete(tab.id);
            });
        });
    }

    /** Send CDP command over WebSocket */
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

    /** Execute JavaScript in page context */
    async executeScript(tab: ChromeTab, script: string): Promise<any> {
        const ws = await this.connectToTab(tab);
        const result = await this.sendCommand(ws, 'Runtime.evaluate', {
            expression: script,
            returnByValue: true,
            awaitPromise: true,
        });
        return result.result?.value;
    }

    /** Navigate existing tab to URL */
    async navigateTo(tab: ChromeTab, url: string): Promise<void> {
        const ws = await this.connectToTab(tab);
        await this.sendCommand(ws, 'Page.navigate', { url });
    }

    /** Disconnect all WebSocket connections */
    disconnect(): void {
        for (const [_, ws] of this.connections) {
            ws.close();
        }
        this.connections.clear();
    }
}
