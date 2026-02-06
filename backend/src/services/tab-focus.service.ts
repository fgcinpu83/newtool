/**
 * ANTIGRAVITY - Tab Focus Service
 * 
 * Service untuk focus tab saat user klik tombol BET
 * Menggunakan Chrome DevTools Protocol
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChromeConnector, checkChromeConnection } from '../chrome/chrome-connector';

interface TabMapping {
    account: 'A' | 'B';
    provider: string;
    urlPattern: string;
}

@Injectable()
export class TabFocusService {
    private readonly logger = new Logger(TabFocusService.name);
    private connector: ChromeConnector;
    private tabMappings: TabMapping[] = [];

    constructor() {
        this.connector = new ChromeConnector(9222);
    }

    /**
     * Register account-to-URL mapping
     */
    registerTab(account: 'A' | 'B', provider: string, urlPattern: string): void {
        // Remove existing mapping for this account
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
            return {
                success: false,
                error: `No URL registered for account ${account}`
            };
        }

        try {
            const tabs = await this.connector.findTabsByUrl(mapping.urlPattern);
            
            if (tabs.length === 0) {
                return {
                    success: false,
                    error: `No tab found for ${mapping.provider} (${mapping.urlPattern})`
                };
            }

            await this.connector.focusTab(tabs[0]);
            
            return {
                success: true,
                tabTitle: tabs[0].title
            };

        } catch (error: any) {
            this.logger.error(`Failed to focus tab for account ${account}:`, error);
            return {
                success: false,
                error: error.message || 'Failed to connect to Chrome'
            };
        }
    }

    /**
     * Check Chrome connection status
     */
    async getStatus(): Promise<{
        chromeConnected: boolean;
        tabCount: number;
        registeredAccounts: { account: string; provider: string; url: string }[];
        error?: string;
    }> {
        const health = await checkChromeConnection();
        
        return {
            chromeConnected: health.connected,
            tabCount: health.tabs,
            registeredAccounts: this.tabMappings.map(t => ({
                account: t.account,
                provider: t.provider,
                url: t.urlPattern
            })),
            error: health.error
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
            const tabs = await this.connector.getTabs();
            
            return tabs.map(tab => {
                const mapping = this.tabMappings.find(m => 
                    tab.url.includes(m.urlPattern)
                );
                
                return {
                    url: tab.url,
                    title: tab.title,
                    matchedAccount: mapping?.account
                };
            });

        } catch (error) {
            this.logger.error('Failed to list tabs:', error);
            return [];
        }
    }
}
