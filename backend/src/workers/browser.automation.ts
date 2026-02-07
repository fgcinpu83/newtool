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
import { AppGateway } from '../gateway.module';
import { RedisService } from '../shared/redis.service';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';

@Injectable()
export class BrowserAutomationService implements OnModuleInit {
    private readonly logger = new Logger(BrowserAutomationService.name);
    private readonly instanceId = Math.random().toString(36).substring(7);

    // account → URL mappings
    private accountUrls = new Map<string, string>();

    // Debounce
    private lastLaunchTime = new Map<string, number>();
    private processedRequests = new Set<string>();

    constructor(
        private gateway: AppGateway,
        private redis: RedisService,
        private chromeManager: ChromeConnectionManager,
    ) {}

    async onModuleInit() {
        this.logger.log(`BrowserAutomationService v5.0 CONSTITUTION MODE (ID: ${this.instanceId})`);

        // Check Chrome connection on startup via manager
        const infoA = await this.chromeManager.attach(9222);
        if (infoA.state === 'CONNECTED') {
            this.logger.log(`Chrome detected on port 9222 (${infoA.tabs} tabs)`);
        } else {
            this.logger.warn(`Chrome NOT detected on port 9222 (state: ${infoA.state}). Run LAUNCH_CHROME.bat first!`);
        }

        this.gateway.commandEvents.on('command', (data) => this.handleCommand(data));
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

        const port = ChromeConnectionManager.portFor(account as 'A' | 'B');
        const result = await this.openUrlViaManager(port, url);

        if (result.success) {
            this.logger.log(`${result.action === 'opened' ? 'Opened new tab' : 'Focused existing tab'}: ${result.tabTitle}`);
            this.gateway.sendUpdate('browser:opened', {
                account, url,
                action: result.action,
                tabTitle: result.tabTitle,
                timestamp: Date.now(),
            });
            this.gateway.sendUpdate('EXECUTE_AUTOMATION', { account, url });
        } else {
            this.logger.error(`Failed: ${result.error}`);
            this.gateway.sendUpdate('browser:error', { account, error: result.error });
            // ChromeLauncher.ensureRunning() is called inside attach() — no fallback needed
        }
    }

    // ─── ALL CHROME ACCESS VIA MANAGER ──────────────

    private async openUrlViaManager(port: number, url: string): Promise<{
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
        let domain = url;
        try { domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname; } catch {}

        const tabs = await this.chromeManager.getTabs(port);
        const existing = tabs.find(tab => {
            try {
                const tabDomain = new URL(tab.url).hostname;
                return tabDomain === domain || tabDomain.endsWith(`.${domain}`);
            } catch { return tab.url.includes(url); }
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
        this.logger.log(`Closing tabs for Account ${account}`);
        this.gateway.sendUpdate('browser:close', { account });
        this.gateway.sendUpdate('browser:closed', { account, timestamp: Date.now() });
    }
}
