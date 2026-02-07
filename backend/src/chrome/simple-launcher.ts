/**
 * SIMPLE CHROME LAUNCHER v2.0 - CONSTITUTION COMPLIANT
 *
 * SYSTEM CONSTITUTION §III.1:
 * - Semua file chrome dilarang buat koneksi sendiri
 * - Status checks MUST go through ChromeConnectionManager
 *
 * This file only handles LAUNCHING Chrome (OS exec).
 * All status/tab checks delegate to ChromeConnectionManager.
 */

import { exec } from 'child_process';
import * as path from 'path';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';

// Track launched accounts to prevent duplicates
const launchedAccounts = new Map<string, number>(); // account -> timestamp

// Chrome paths to try
const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
];

function findChromePath(): string | null {
    const fs = require('fs');
    for (const chromePath of CHROME_PATHS) {
        if (fs.existsSync(chromePath)) {
            return chromePath;
        }
    }
    return null;
}

/**
 * Launch Chrome with remote debugging and navigate to URL
 * Uses separate user-data-dir per account to allow multiple instances
 */
export async function launchChromeForAccount(
    account: 'A' | 'B',
    url: string
): Promise<{ success: boolean; message: string }> {

    // Dedup check - don't launch same account within 5 seconds
    const lastLaunch = launchedAccounts.get(account) || 0;
    if (Date.now() - lastLaunch < 5000) {
        console.log(`[LAUNCHER] Account ${account} already launched recently`);
        return { success: true, message: 'Already launched' };
    }
    launchedAccounts.set(account, Date.now());

    const chromePath = findChromePath();
    if (!chromePath) {
        return { success: false, message: 'Chrome not found' };
    }

    // Ensure URL has protocol
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        fullUrl = `https://${url}`;
    }

    // Use different ports for different accounts
    const debugPort = ChromeConnectionManager.portFor(account);

    // Separate user data directory per account
    const userDataDir = path.join(process.env.TEMP || 'C:\\Temp', `chrome-debug-${account}`);

    const args = [
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir="${userDataDir}"`,
        '--no-first-run',
        '--no-default-browser-check',
        `"${fullUrl}"`
    ];

    const command = `"${chromePath}" ${args.join(' ')}`;

    console.log(`[LAUNCHER] Launching Chrome for Account ${account}`);

    return new Promise((resolve) => {
        exec(command, (error) => {
            if (error) {
                // Error code 1 often means Chrome is already running - that's OK
                if (error.code === 1) {
                    console.log(`[LAUNCHER] Chrome already running for Account ${account}`);
                    resolve({ success: true, message: 'Chrome already running' });
                } else {
                    console.error(`[LAUNCHER] Failed to launch Chrome:`, error.message);
                    resolve({ success: false, message: error.message });
                }
            } else {
                console.log(`[LAUNCHER] Chrome launched for Account ${account}`);
                resolve({ success: true, message: 'Chrome launched' });
            }
        });
    });
}

/**
 * Check if Chrome debug port is active.
 * DELEGATES to ChromeConnectionManager.
 */
export async function isChromeLaunched(account: 'A' | 'B', manager: ChromeConnectionManager): Promise<boolean> {
    const port = ChromeConnectionManager.portFor(account);
    const info = await manager.attach(port);
    return info.state === 'CONNECTED';
}

/**
 * Get all open tabs for an account.
 * DELEGATES to ChromeConnectionManager.
 */
export async function getAccountTabs(account: 'A' | 'B', manager: ChromeConnectionManager): Promise<any[]> {
    const port = ChromeConnectionManager.portFor(account);
    if (!manager.isConnected(port)) return [];
    return await manager.getTabs(port);
}
