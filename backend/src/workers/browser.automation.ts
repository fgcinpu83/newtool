import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { exec } from 'child_process';
import { AppGateway } from '../gateway.module';
import { RedisService } from '../shared/redis.service';
import { openUrlInChrome, checkChromeConnection, focusAccountTab } from '../chrome/chrome-connector';
import * as fs from 'fs';
import * as path from 'path';

/**
 * BROWSER AUTOMATION SERVICE - DESKTOP EDITION v4.0
 * 
 * Handles automatic desktop browser tab opening when account is toggled ON.
 * Now uses Chrome DevTools Protocol (CDP) for more reliable control.
 * 
 * ARCHITECTURE:
 * - User runs LAUNCH_CHROME.bat (opens Chrome with --remote-debugging-port=9222)
 * - Frontend sends OPEN_BROWSER command with account + url
 * - This service uses CDP to open new tab or focus existing
 * - Extension in browser auto-captures session
 * - Session flows to backend → Workers start
 * 
 * WORKFLOW:
 * 1. Toggle ON Account A → Opens URL in Chrome tab
 * 2. Toggle ON Account B → Opens URL in new Chrome tab
 * 3. Click BET button → Focus the correct tab
 */

@Injectable()
export class BrowserAutomationService implements OnModuleInit {
    private readonly logger = new Logger(BrowserAutomationService.name);
    private readonly instanceId = Math.random().toString(36).substring(7);
    
    // Store account → URL mappings
    private accountUrls = new Map<string, string>();

    constructor(
        private gateway: AppGateway,
        private redis: RedisService
    ) { }

    async onModuleInit() {
        this.logger.log(`🌐 BrowserAutomationService v4.0 CDP MODE (InstanceID: ${this.instanceId})`);

        // Check Chrome connection on startup
        const chromeStatus = await checkChromeConnection();
        if (chromeStatus.connected) {
            this.logger.log(`✅ Chrome detected on port 9222 (${chromeStatus.tabs} tabs open)`);
        } else {
            this.logger.warn(`⚠️ Chrome NOT detected on port 9222. Run LAUNCH_CHROME.bat first!`);
        }

        this.gateway.commandEvents.on('command', (data) => this.handleCommand(data));
    }

    private async handleCommand(data: any) {
        if (!data || !data.type) return;

        const { type, payload } = data;
        
        // � v12.0: OPEN_BROWSER is now handled by HTTP API in main.ts
        // This WebSocket handler is DISABLED to prevent duplicates
        if (type === 'OPEN_BROWSER') {
            console.log(`[BrowserAutomation] ⏭️ OPEN_BROWSER ignored (now handled by HTTP API)`);
            return; // DO NOTHING - HTTP API handles this
        }

        switch (type) {
            // OPEN_BROWSER removed - handled by HTTP API

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

    /**
     * Open URL in Chrome tab using CDP
     * Called when user toggles account ON
     */
    private lastLaunchTime = new Map<string, number>();
    private processedRequests = new Set<string>(); // Track processed request IDs

    private async openBrowserTab(payload: { account: string; url: string; requestId?: string }) {
        const { account, url, requestId } = payload;
        
        console.log(`[AUDIT-CDP] 📥 openBrowserTab START: account=${account} requestId=${requestId} processedCount=${this.processedRequests.size}`);

        // REQUEST ID DUPLICATE CHECK (if provided)
        if (requestId) {
            if (this.processedRequests.has(requestId)) {
                console.log(`[AUDIT-CDP] 🚫 BLOCKED: Duplicate requestId ${requestId}`);
                this.logger.warn(`[CDP] 🚫 Duplicate request ID: ${requestId}`);
                return;
            }
            this.processedRequests.add(requestId);
            console.log(`[AUDIT-CDP] ✅ Added requestId ${requestId} to processed set`);
            // Clean old request IDs after 10 seconds
            setTimeout(() => this.processedRequests.delete(requestId), 10000);
        }

        // DEBOUNCE CHECK (per account, 3 second window)
        const last = this.lastLaunchTime.get(account) || 0;
        const now = Date.now();
        if (now - last < 3000) {
            this.logger.warn(`[CDP] 🚫 Debounced duplicate request for ${account} (within 3s)`);
            return;
        }
        this.lastLaunchTime.set(account, now);

        if (!url || url.trim() === '') {
            this.logger.warn(`[CDP] Cannot open browser for Account ${account}: No URL provided`);
            this.gateway.sendUpdate('browser:error', {
                account,
                error: 'URL is empty. Please enter a URL first.'
            });
            return;
        }

        this.logger.log(`[CDP] 🚀 Opening browser for Account ${account}: ${url}`);
        this.logToWire(`[BROWSER] 🚀 Opening ${url} for Account ${account}`);

        // Store URL mapping for later focus
        this.accountUrls.set(account, url);

        // Use CDP to open/focus tab
        const result = await openUrlInChrome(url, account as 'A' | 'B');

        if (result.success) {
            this.logger.log(`[CDP] ✅ ${result.action === 'opened' ? 'Opened new tab' : 'Focused existing tab'}: ${result.tabTitle}`);
            this.logToWire(`[BROWSER] ✅ ${result.action.toUpperCase()}: ${url}`);
            
            this.gateway.sendUpdate('browser:opened', {
                account,
                url,
                action: result.action,
                tabTitle: result.tabTitle,
                timestamp: Date.now()
            });

            // Also notify extension to track this tab
            this.gateway.sendUpdate('EXECUTE_AUTOMATION', { account, url });
            
        } else {
            this.logger.error(`[CDP] ❌ Failed: ${result.error}`);
            this.logToWire(`[BROWSER] ❌ Failed: ${result.error}`);
            
            this.gateway.sendUpdate('browser:error', {
                account,
                error: result.error
            });

            // FALLBACK: Try OS-level launch if CDP fails
            if (result.error?.includes('not running')) {
                this.logger.log(`[CDP] Attempting OS fallback launch...`);
                await this.fallbackOSLaunch(account, url);
            }
        }
    }

    /**
     * Focus tab for account (used by BET button)
     */
    private async focusTab(payload: { account: string }) {
        const { account } = payload;
        const url = this.accountUrls.get(account);

        if (!url) {
            this.gateway.sendUpdate('browser:error', {
                account,
                error: `No URL registered for account ${account}`
            });
            return;
        }

        const result = await focusAccountTab(url);

        if (result.success) {
            this.logger.log(`[CDP] 🎯 Focused tab for Account ${account}`);
            this.gateway.sendUpdate('browser:focused', {
                account,
                tabTitle: result.tabTitle
            });
        } else {
            this.gateway.sendUpdate('browser:error', {
                account,
                error: result.error
            });
        }
    }

    /**
     * Report Chrome connection status
     */
    private async reportChromeStatus() {
        const status = await checkChromeConnection();
        this.gateway.sendUpdate('chrome:status', status);
    }

    /**
     * Fallback: Launch Chrome via OS command
     */
    private async fallbackOSLaunch(account: string, url: string) {
        const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
        const CHROME_PATH_X86 = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
        const chromeExe = fs.existsSync(CHROME_PATH) ? CHROME_PATH : (fs.existsSync(CHROME_PATH_X86) ? CHROME_PATH_X86 : null);

        if (!chromeExe) {
            this.logger.error(`[FALLBACK] Chrome.exe not found`);
            return;
        }

        const rootDir = path.join(process.cwd(), '..');
        const extPath = path.join(rootDir, 'extension_desktop');
        const userData = path.join(rootDir, 'chrome_profile');

        // Ensure URL has protocol
        let fullUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            fullUrl = `https://${url}`;
        }

        const cmd = `"${chromeExe}" --remote-debugging-port=9222 --user-data-dir="${userData}" --load-extension="${extPath}" --no-first-run "${fullUrl}"`;

        this.logger.log(`[FALLBACK] Launching Chrome: ${cmd.substring(0, 80)}...`);

        exec(cmd, (error) => {
            if (error) {
                this.logger.error(`[FALLBACK] Launch failed: ${error.message}`);
            } else {
                this.logger.log(`[FALLBACK] ✅ Chrome launched successfully`);
                this.gateway.sendUpdate('browser:opened', {
                    account,
                    url: fullUrl,
                    action: 'fallback_launched',
                    timestamp: Date.now()
                });
            }
        });
    }

    /**
     * Close browser tabs for account
     */
    private async closeBrowserTabs(payload: { account: string }) {
        const { account } = payload;

        this.logger.log(`[BROWSER] 🚫 Closing tabs for Account ${account}`);

        // Send close command to extension
        this.gateway.sendUpdate('browser:close', { account });

        this.gateway.sendUpdate('browser:closed', {
            account,
            timestamp: Date.now()
        });
    }

    // 🔒 v3.1 FIX: toggleAccount method REMOVED
    // All toggle logic now consolidated in WorkerService to prevent race conditions

    private logToWire(msg: string) {
        try {
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
            const WIRE_LOG = path.join(logDir, 'wire_debug.log');
            fs.appendFileSync(WIRE_LOG, `[${new Date().toISOString()}] ${msg}\n`);
        } catch (e) { }
    }
}
