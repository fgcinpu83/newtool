/**
 * Chrome Controller v2.0 - CONSTITUTION COMPLIANT
 *
 * SYSTEM CONSTITUTION §III.1:
 * - All Chrome access through ChromeConnectionManager
 * - No direct CDP/HTTP calls
 */

import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';
import { launchChromeForAccount, isChromeLaunched, getAccountTabs } from './simple-launcher';

interface LaunchChromeDto {
    account: 'A' | 'B';
    url: string;
}

@Controller('api')
export class ChromeController {

    constructor(private readonly chromeManager: ChromeConnectionManager) {}

    @Post('launch-chrome')
    @HttpCode(HttpStatus.OK)
    async launchChrome(@Body() body: LaunchChromeDto) {
        const { account, url } = body || {};

        if (!account || !url) {
            return { success: false, message: 'Missing account or url' };
        }

        if (account !== 'A' && account !== 'B') {
            return { success: false, message: 'Invalid account (must be A or B)' };
        }

        console.log(`[API] Launch Chrome request: Account ${account} -> ${url}`);

        try {
            const result = await launchChromeForAccount(account, url);
            return result;
        } catch (error: any) {
            console.error('[API] Launch Chrome error:', error);
            return { success: false, message: error.message };
        }
    }

    @Get('chrome-status')
    async getStatus() {
        try {
            const statusA = await isChromeLaunched('A', this.chromeManager);
            const statusB = await isChromeLaunched('B', this.chromeManager);
            const tabsA = statusA ? await getAccountTabs('A', this.chromeManager) : [];
            const tabsB = statusB ? await getAccountTabs('B', this.chromeManager) : [];

            return {
                A: { running: statusA, tabs: tabsA.length, urls: tabsA.map((t: any) => t.url) },
                B: { running: statusB, tabs: tabsB.length, urls: tabsB.map((t: any) => t.url) }
            };
        } catch (error: any) {
            console.error('[API] Chrome status error:', error);
            return { error: error.message };
        }
    }
}
