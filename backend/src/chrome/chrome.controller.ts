/**
 * Chrome Controller v3.0 — CONSTITUTION §III.1 + STEP 3.1
 *
 * All Chrome access through ChromeConnectionManager.
 * Launch goes through attach() which calls ChromeLauncher internally.
 * No direct CDP/HTTP calls.
 */

import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';

interface LaunchChromeDto {
    account: 'A' | 'B';
    url?: string;  // URL is optional — launcher opens Chrome without navigating
}

@Controller('api')
export class ChromeController {

    constructor(private readonly chromeManager: ChromeConnectionManager) {}

    /**
     * POST /api/launch-chrome
     * Calls ChromeConnectionManager.attach() which internally
     * calls ChromeLauncher.ensureRunning() — idempotent.
     */
    @Post('launch-chrome')
    @HttpCode(HttpStatus.OK)
    async launchChrome(@Body() body: LaunchChromeDto) {
        const { account } = body || {};

        if (!account || (account !== 'A' && account !== 'B')) {
            return { success: false, message: 'Invalid account (must be A or B)' };
        }

        const port = ChromeConnectionManager.portFor(account);
        console.log(`[API] Launch Chrome request: Account ${account} port ${port}`);

        try {
            const info = await this.chromeManager.attach(port);
            return {
                success: info.state === 'CONNECTED',
                state: info.state,
                message: info.state === 'CONNECTED'
                    ? `Chrome ${account} connected (port ${port})`
                    : `Chrome ${account} failed: ${info.errorMessage || info.state}`,
            };
        } catch (error: any) {
            console.error('[API] Launch Chrome error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * GET /api/chrome-status
     * Read-only — returns current state without launching.
     */
    @Get('chrome-status')
    async getStatus() {
        try {
            const infoA = this.chromeManager.getInfoForAccount('A');
            const infoB = this.chromeManager.getInfoForAccount('B');

            const tabsA = infoA.state === 'CONNECTED' ? await this.chromeManager.getTabs(ChromeConnectionManager.portFor('A')) : [];
            const tabsB = infoB.state === 'CONNECTED' ? await this.chromeManager.getTabs(ChromeConnectionManager.portFor('B')) : [];

            return {
                A: { state: infoA.state, tabs: tabsA.length, urls: tabsA.map((t: any) => t.url) },
                B: { state: infoB.state, tabs: tabsB.length, urls: tabsB.map((t: any) => t.url) },
            };
        } catch (error: any) {
            console.error('[API] Chrome status error:', error);
            return { error: error.message };
        }
    }
}
