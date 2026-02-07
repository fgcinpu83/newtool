/**
 * TAB FOCUS SERVICE v2.0 - CONSTITUTION COMPLIANT
 *
 * SYSTEM CONSTITUTION §III.1:
 * - DILARANG membuat koneksi CDP langsung
 * - HARUS memanggil ChromeConnectionManager
 *
 * Service untuk focus tab saat user klik tombol BET.
 * ALL Chrome access goes through ChromeConnectionManager.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';

interface TabMapping {
    account: 'A' | 'B';
    provider: string;
    urlPattern: string;
}

@Injectable()
export class TabFocusService {
    private readonly logger = new Logger(TabFocusService.name);
    private tabMappings: TabMapping[] = [];

    constructor(private chromeManager: ChromeConnectionManager) {}

    /**
     * Register account-to-URL mapping
     */
    registerTab(account: 'A' | 'B', provider: string, urlPattern: string): void {
        this.tabMappings = this.tabMappings.filter(t => t.account !== account);
        this.tabMappings.push({ account, provider, urlPattern });
        this.logger.log(`Registered tab mapping: ${account} -> ${provider} (${urlPattern})`);
    }

    /**
     * Focus tab for specific account
     * Called when user clicks BET button
     */
    async focusAccountTab(account: 'A' | 'B'): Promise<{
        success: boolean;
        tabTitle?: string;
        error?: string;
    }> {
        const mapping = this.tabMappings.find(t => t.account === account);

        if (!mapping) {
            return { success: false, error: `No URL registered for account ${account}` };
        }

        const port = ChromeConnectionManager.portFor(account);

        try {
            // ALL access through manager — no direct CDP
            const tabs = await this.chromeManager.getTabs(port);
            const matches = tabs.filter(t => t.url.includes(mapping.urlPattern));

            if (matches.length === 0) {
                return {
                    success: false,
                    error: `No tab found for ${mapping.provider} (${mapping.urlPattern})`,
                };
            }

            await this.chromeManager.focusTab(port, matches[0].id);
            return { success: true, tabTitle: matches[0].title };

        } catch (error: any) {
            this.logger.error(`Failed to focus tab for account ${account}:`, error);
            return { success: false, error: error.message || 'Failed to connect to Chrome' };
        }
    }

    /**
     * Check Chrome connection status (via manager — no side effects)
     */
    async getStatus(): Promise<{
        chromeConnected: boolean;
        tabCount: number;
        registeredAccounts: { account: string; provider: string; url: string }[];
        error?: string;
    }> {
        const info = this.chromeManager.getInfo(9222);
        const chromeConnected = info.state === 'CONNECTED';

        return {
            chromeConnected,
            tabCount: info.tabs,
            registeredAccounts: this.tabMappings.map(t => ({
                account: t.account,
                provider: t.provider,
                url: t.urlPattern,
            })),
            error: chromeConnected ? undefined : `Chrome not reachable on port 9222 (state: ${info.state})`,
        };
    }

    /**
     * List all open sportsbook tabs
     */
    async listSportsbookTabs(): Promise<{
        url: string;
        title: string;
        matchedAccount?: 'A' | 'B';
    }[]> {
        try {
            const tabs = await this.chromeManager.getTabs(9222);

            return tabs.map(tab => {
                const mapping = this.tabMappings.find(m =>
                    tab.url.includes(m.urlPattern),
                );
                return {
                    url: tab.url,
                    title: tab.title,
                    matchedAccount: mapping?.account,
                };
            });

        } catch (error) {
            this.logger.error('Failed to list tabs:', error);
            return [];
        }
    }
}
