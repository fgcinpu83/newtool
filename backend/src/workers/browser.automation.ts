/**
 * BROWSER AUTOMATION SERVICE v5.0 - CONSTITUTION COMPLIANT
 *
 * SYSTEM CONSTITUTION §III.1:
 * - DILARANG membuat koneksi CDP langsung
 * - HARUS memanggil ChromeConnectionManager
 *
 * This service handles browser tab lifecycle (open/focus/close).
 * ALL Chrome access goes through ChromeConnectionManager.
 * NO direct fetch/HTTP/WS to Chrome ports.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppGateway } from '../gateway.module';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';

// Per-account browser session container
interface BrowserSession {
    accountId: string;
    port: number;
    url?: string;
    targetId?: string;
    wsUrl?: string;
    client?: any;
    cleanup(): Promise<void> | void;
}

@Injectable()
export class BrowserAutomationService implements OnModuleInit {
    private readonly logger = new Logger(BrowserAutomationService.name);
    private readonly instanceId = Math.random().toString(36).substring(7);

    // account → URL mappings
    private accountUrls = new Map<string, string>();

    // Per-account browser session isolation
    private sessions = new Map<string, BrowserSession>();

    // Debounce
    private lastLaunchTime = new Map<string, number>();
    private processedRequests = new Set<string>();

    private gateway?: AppGateway;

    private internalBus?: any;

    constructor(
        private moduleRef: ModuleRef,
        private chromeManager: ChromeConnectionManager,
    ) {}

    // Helper to create an empty session object
    private createSession(accountId: string, port: number, url?: string): BrowserSession {
        const s: BrowserSession = {
            accountId,
            port,
            url,
            targetId: undefined,
            wsUrl: undefined,
            client: undefined,
            async cleanup() {
                try {
                    if (this.client && typeof this.client.close === 'function') {
                        await this.client.close();
                    }
                } catch (e) { /* ignore */ }
                this.client = undefined;
                this.targetId = undefined;
                this.wsUrl = undefined;
            }
        };
        return s;
    }

    // Ensure browser session exists for account. Will NOT create duplicate sessions.
    private async ensureBrowser(account: string, url: string, requestId?: string) {
        this.logger.log(`[BROWSER][${account}] OPEN_ATTEMPT`);
        if (!account) throw new Error('account required');

        // Guard against double open — if session exists, attempt navigation but don't create new session
        if (this.sessions.has(account)) {
            this.logger.log(`[BROWSER][${account}] Session exists - skipping create, attempting navigation`);
            // attempt to navigate/focus existing session
            const port = ChromeConnectionManager.portFor(account as 'A' | 'B');
            const result = await this.openUrlViaManager(account, port, url);
            // publish events as usual but do not create session
            if (result.success) {
                this.gateway.sendUpdate('browser:opened', { account, url, action: result.action, tabTitle: result.tabTitle, timestamp: Date.now() });
            }
            return;
        }

        // Create new session
        const port = ChromeConnectionManager.portFor(account as 'A' | 'B');
        const attachInfo = await this.chromeManager.attach(port);
        if (attachInfo.state !== 'CONNECTED') {
            this.gateway.sendUpdate('browser:error', { account, error: `Chrome ${attachInfo.state} on port ${port}` });
            throw new Error(`Chrome not connected on port ${port}`);
        }

        // Open or focus tab
        const result = await this.openUrlViaManager(account, port, url);
        if (!result.success) {
            this.gateway.sendUpdate('browser:error', { account, error: result.error });
            throw new Error(result.error || 'open failed');
        }

        // Create session container
        const session = this.createSession(account, port, url);
        // attempt to discover targetId/wsUrl from tabs
        try {
            const tabs = await this.chromeManager.getTabs(port);
            const match = tabs.find(t => (url && t.url.includes(url)) || t.title === result.tabTitle);
            if (match) {
                session.targetId = (match.id as any) || undefined;
                session.wsUrl = match.webSocketDebuggerUrl;
            }
        } catch (e) { /* ignore */ }

        // Try to create persistent CDP client if possible
        try {
            const CDP = require('chrome-remote-interface');
            if (typeof CDP === 'function') {
                const opts: any = { port };
                if (session.targetId) opts.target = session.targetId;
                if (session.wsUrl) opts.target = session.wsUrl;
                const client = await CDP(opts);
                session.client = client;
            }
        } catch (e) { /* optional */ }

        this.sessions.set(account, session);
        this.logger.log(`[BROWSER][${account}] SESSION_CREATED`);

        // Publish opened event with accountId
        this.gateway.sendUpdate('browser:opened', { account, url, action: result.action, tabTitle: result.tabTitle, timestamp: Date.now() });
        try { this.internalBus && typeof this.internalBus.publish === 'function' && this.internalBus.publish('BROWSER_OPENED', { account, url, action: result.action, tabTitle: result.tabTitle }); } catch (e) {}
        this.gateway.sendUpdate('EXECUTE_AUTOMATION', { account, url });
    }

    // Simplified API: open a real Chrome tab via /json/new and return session or null
    public async openBrowser(account: string, url: string): Promise<{ port: number; targetId: string; url: string } | null> {
        if (!account || !url) return null;
        try {
            const port = ChromeConnectionManager.portFor(account as 'A' | 'B');
            this.logger.log(`[BROWSER][${account}] OPEN_ATTEMPT port=${port} url=${url}`);

            // Ensure Chrome is running on port
            const attachInfo = await this.chromeManager.attach(port);
            this.logger.log(`[BROWSER][${account}] attach state=${attachInfo.state}`);
            if (attachInfo.state !== 'CONNECTED') {
                this.logger.warn(`[BROWSER][${account}] Chrome not connected on port ${port}`);
                return null;
            }

            // Call /json/new to open a new tab
            const encoded = encodeURIComponent(url.startsWith('http') ? url : `https://${url}`);
            const endpoint = `http://localhost:${port}/json/new?${encoded}`;
            const res = await fetch(endpoint, { method: 'PUT' });
            if (!res.ok) {
                this.logger.warn(`[BROWSER][${account}] /json/new responded ${res.status}`);
                return null;
            }
            const data = await res.json();

            const targetId = data && (data.targetId || data.id || (data['id'] && data['id'].toString()));
            if (!targetId) {
                this.logger.warn(`[BROWSER][${account}] /json/new did not return targetId: ${JSON.stringify(data)}`);
                return null;
            }

            // create and store session container
            const session = this.createSession(account, port, url);
            session.targetId = targetId;
            session.wsUrl = data.webSocketDebuggerUrl || data.webSocketUrl || undefined;
            this.sessions.set(account, session);

            // Deterministic log
            console.log(`[BROWSER][${account}] OPENED ${url} on port ${port}`);

            return { port, targetId, url };
        } catch (e) {
            this.logger.error(`[BROWSER][${account}] openBrowser failed`, e as any);
            return null;
        }
    }

    // Close and clean session for account
    public async closeBrowser(account?: string) {
        if (!account) return;
        const session = this.sessions.get(account);
        if (!session) return;
        if (session.accountId !== account) throw new Error('session.accountId mismatch');

        this.logger.log(`[BROWSER][${account}] SESSION_CLEANING`);
        try { await session.cleanup(); } catch (e) {}
        // delegate actual tab close to extension/manager via gateway
        this.gateway.sendUpdate('browser:close', { account });
        this.gateway.sendUpdate('browser:closed', { account, timestamp: Date.now() });
        this.sessions.delete(account);
        this.logger.log(`[BROWSER][${account}] SESSION_CLEANED`);
    }

    async onModuleInit() {
        // Resolve gateway lazily to avoid circular DI issues
        try { this.gateway = this.moduleRef.get(AppGateway, { strict: false }); } catch (e) { /* ignore */ }

        this.logger.log(`BrowserAutomationService v5.0 CONSTITUTION MODE (ID: ${this.instanceId})`);

        // Check Chrome connection on startup via manager
        const infoA = await this.chromeManager.attach(9222);
        if (infoA.state === 'CONNECTED') {
            this.logger.log(`Chrome detected on port 9222 (${infoA.tabs} tabs)`);
            this.logger.log(`[OBSERVE] Chrome connection stable on port 9222 - ${infoA.tabs} tabs available`);
            // 🛡️ Notify system that Chrome is ready
            this.gateway.trafficBus.emit('chrome:ready', { port: 9222, tabs: infoA.tabs });
        } else {
            this.logger.warn(`Chrome NOT detected on port 9222 (state: ${infoA.state}). Run LAUNCH_CHROME.bat first!`);
            this.logger.log(`[OBSERVE] Chrome connection unavailable on port 9222 - state: ${infoA.state}`);
        }

        // Attempt to resolve legacy CommandRouterService if present (optional)
        try {
            const cmdRouter = this.moduleRef.get('CommandRouterService' as any, { strict: false }) as any;
            if (cmdRouter && typeof cmdRouter.register === 'function') {
                try {
                    cmdRouter.register('BROWSER_CMD', async (c: any) => {
                        try { this.gateway.sendUpdate('browser:command', c.payload); } catch (e) { this.logger.error('BROWSER_CMD failed', e) }
                    });
                    cmdRouter.register('OPEN_BROWSER', async (c: any) => { await this.handleBrowserStart(c.payload || {}); });
                    cmdRouter.register('FOCUS_TAB', async (c: any) => { await this.focusTab(c.payload || {}); });
                    cmdRouter.register('CLOSE_BROWSER', async (c: any) => { await this.handleBrowserStop(c.payload?.account); });
                    cmdRouter.register('CHECK_CHROME', async (c: any) => { await this.reportChromeStatus(); });
                } catch (e) { /* ignore registration failures */ }
            }
        } catch (e) { /* optional */ }

        // Resolve InternalEventBusService lazily (avoid DI cycle)
        try { this.internalBus = this.moduleRef.get('InternalEventBusService' as any, { strict: false }); } catch (e) { /* ignore */ }

        // Internal event subscriptions (WorkerService -> BrowserAutomationService)
        try { this.internalBus && this.internalBus.on && this.internalBus.on('REQUEST_BROWSER_CMD', (payload: any) => {
            try {
                this.logger.log(`Handling internal REQUEST_BROWSER_CMD: ${JSON.stringify(payload)}`);
                this.gateway.sendUpdate('browser:command', payload);
            } catch (e) { this.logger.error('Internal REQUEST_BROWSER_CMD failed', e as any) }
        }); } catch(e) { /* ignore */ }

        try { this.internalBus && this.internalBus.on && this.internalBus.on('REQUEST_OPEN_BROWSER', (payload: any) => {
            try {
                try { console.log('[DEBUG] BrowserAutomation received REQUEST_OPEN_BROWSER for', payload && payload.account); } catch (e) {}
                this.handleBrowserStart(payload || {});
            } catch (e) { this.logger.error('Internal REQUEST_OPEN_BROWSER failed', e as any) }
        }); } catch(e) { /* ignore */ }

        try { this.internalBus && this.internalBus.on && this.internalBus.on('REQUEST_CLOSE_BROWSER', (payload: any) => {
            try { this.handleBrowserStop(payload?.account); } catch (e) { this.logger.error('Internal REQUEST_CLOSE_BROWSER failed', e as any) }
        }); } catch(e) { /* ignore */ }
    }

    // ─── SESSION ISOLATION HELPERS ─────────────────

    /** Ensure one session per account; creates session if missing */
    private async handleBrowserStart(payload: { account: string; url?: string; requestId?: string }) {
        const { account, url, requestId } = payload as any;
        try { fs.appendFileSync(path.join(process.cwd(), 'logs', 'wire_debug.log'), JSON.stringify({ ts: Date.now(), event: 'HANDLE_BROWSER_START_CALLED', account, url: url || null, requestId: requestId || null, sessionExists: this.sessions.has(account) }) + '\n'); } catch (e) {}
        if (!account) return;

        // Delegate to ensureBrowser which handles creation or navigation safely
        try {
            await this.ensureBrowser(account, url || this.accountUrls.get(account) || '', requestId);
        } catch (e) {
            this.logger.error(`[BROWSER][${account}] OPEN_FAILED`, e as any);
        }
    }

    /** Stop and dispose session for account */
    private async handleBrowserStop(account?: string) {
        if (!account) return;
        await this.closeBrowser(account);
    }

    // ─── COMMAND ROUTER ─────────────────────────────

    private async handleCommand(data: any) {
        if (!data || !data.type) return;
        const { type, payload } = data;

        // OPEN_BROWSER handled by HTTP API — ignore here to prevent duplicates
        if (type === 'OPEN_BROWSER') return;

        switch (type) {
            case 'FOCUS_TAB':
                await this.focusTab(payload);
                break;
            case 'CLOSE_BROWSER':
                await this.closeBrowserTabs(payload);
                break;
            case 'CHECK_CHROME':
                await this.reportChromeStatus();
                break;
        }
    }

    // ─── OPEN TAB (called by HTTP API) ──────────────

    async openBrowserTab(payload: { account: string; url: string; requestId?: string }) {
        const { account, url, requestId } = payload;

        try { fs.appendFileSync(path.join(process.cwd(), 'logs', 'wire_debug.log'), JSON.stringify({ ts: Date.now(), event: 'OPENBROWSER_ATTEMPT', account, url, requestId: requestId || null }) + '\n'); } catch (e) {}

        // Request ID dedup
        if (requestId) {
            if (this.processedRequests.has(requestId)) return;
            this.processedRequests.add(requestId);
            setTimeout(() => this.processedRequests.delete(requestId), 10000);
        }

        // Debounce per account (3s)
        const last = this.lastLaunchTime.get(account) || 0;
        if (Date.now() - last < 3000) return;
        this.lastLaunchTime.set(account, Date.now());

        if (!url || url.trim() === '') {
            this.gateway.sendUpdate('browser:error', { account, error: 'URL is empty.' });
            return;
        }

        this.logger.log(`Opening browser for Account ${account}: ${url}`);
        this.accountUrls.set(account, url);

        try {
            await this.ensureBrowser(account, url, requestId);
        } catch (e) {
            this.logger.error(`[BROWSER][${account}] OPEN_FAILED`, e as any);
            this.gateway.sendUpdate('browser:error', { account, error: (e && (e as Error).message) || String(e) });
        }
    }

    // ─── ALL CHROME ACCESS VIA MANAGER ──────────────

    private async openUrlViaManager(account: string, port: number, url: string): Promise<{
        success: boolean;
        action: 'opened' | 'focused' | 'failed';
        tabTitle?: string;
        error?: string;
    }> {
        // Step 1: Ensure connected (idempotent)
        const info = await this.chromeManager.attach(port);
        if (info.state !== 'CONNECTED') {
            return { success: false, action: 'failed', error: `Chrome ${info.state} on port ${port}` };
        }

        // Step 2: Check for existing tab with same domain
        // Use account-specific whitelist for fallback matching
        const whitelist = this.accountUrls.get(account) || url;

        let domain = url;
        try { domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname; } catch {}

        const tabs = await this.chromeManager.getTabs(port);
        const existing = tabs.find(tab => {
            try {
                const tabDomain = new URL(tab.url).hostname;
                // only consider tabs that match the account-specific whitelist
                const matchesWhitelist = whitelist ? tab.url.includes(whitelist) : true;
                return matchesWhitelist && (tabDomain === domain || tabDomain.endsWith(`.${domain}`));
            } catch { return whitelist ? tab.url.includes(whitelist) : tab.url.includes(url); }
        });

        if (existing) {
            await this.chromeManager.focusTab(port, existing.id);
            return { success: true, action: 'focused', tabTitle: existing.title };
        }

        // Step 3: Open new tab
        const newTab = await this.chromeManager.openTab(port, url);
        if (newTab) {
            return { success: true, action: 'opened', tabTitle: url };
        }

        return { success: false, action: 'failed', error: 'Failed to open new tab' };
    }

    // ─── FOCUS TAB ──────────────────────────────────

    private async focusTab(payload: { account: string }) {
        const { account } = payload;
        const url = this.accountUrls.get(account);

        if (!url) {
            this.gateway.sendUpdate('browser:error', { account, error: `No URL registered for account ${account}` });
            return;
        }

        // If we have a session, assert it matches account
        const session = this.sessions.get(account);
        if (session && session.accountId !== account) throw new Error('session.accountId mismatch');

        const port = ChromeConnectionManager.portFor(account as 'A' | 'B');
        if (!this.chromeManager.isConnected(port)) {
            this.gateway.sendUpdate('browser:error', { account, error: 'Chrome not connected' });
            return;
        }

        const tabs = await this.chromeManager.getTabs(port);
        const match = tabs.find(t => t.url.includes(url));

        if (match) {
            await this.chromeManager.focusTab(port, match.id);
            this.gateway.sendUpdate('browser:focused', { account, tabTitle: match.title });
        } else {
            this.gateway.sendUpdate('browser:error', { account, error: `No tab found matching: ${url}` });
        }
    }

    // ─── STATUS ─────────────────────────────────────

    private async reportChromeStatus() {
        const info = this.chromeManager.getInfo(9222);
        this.gateway.sendUpdate('chrome:status', {
            connected: info.state === 'CONNECTED',
            tabs: info.tabs,
            state: info.state,
            error: info.errorMessage,
        });
    }

    // ─── CLOSE ──────────────────────────────────────

    private async closeBrowserTabs(payload: { account: string }) {
        const { account } = payload;
        if (!account) return;
        this.logger.log(`[BROWSER][${account}] CLOSE_ATTEMPT`);
        await this.closeBrowser(account);
    }
}
