/**
 * SIMPLE CHROME LAUNCHER v1.0
 * 
 * Direct Chrome launch - no complex CDP, no duplicates
 * Toggle ON → Launch Chrome Debug → Navigate to URL
 */

import { exec } from 'child_process';
import * as path from 'path';

// Track launched accounts to prevent duplicates
const launchedAccounts = new Map<string, number>(); // account -> timestamp

// Chrome paths to try
const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
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
        console.log(`[LAUNCHER] 🚫 Account ${account} already launched recently`);
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
    const debugPort = account === 'A' ? 9222 : 9223;
    
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
    
    console.log(`[LAUNCHER] 🚀 Launching Chrome for Account ${account}`);
    console.log(`[LAUNCHER] Command: ${command}`);

    return new Promise((resolve) => {
        exec(command, (error) => {
            if (error) {
                // Error code 1 often means Chrome is already running - that's OK
                if (error.code === 1) {
                    console.log(`[LAUNCHER] ✅ Chrome already running for Account ${account}`);
                    resolve({ success: true, message: 'Chrome already running' });
                } else {
                    console.error(`[LAUNCHER] ❌ Failed to launch Chrome:`, error.message);
                    resolve({ success: false, message: error.message });
                }
            } else {
                console.log(`[LAUNCHER] ✅ Chrome launched for Account ${account}`);
                resolve({ success: true, message: 'Chrome launched' });
            }
        });
    });
}

/**
 * Check if Chrome debug port is active
 */
export function isChromeLaunched(account: 'A' | 'B'): Promise<boolean> {
    const debugPort = account === 'A' ? 9222 : 9223;
    const http = require('http');
    
    return new Promise((resolve) => {
        try {
            const req = http.get(`http://localhost:${debugPort}/json/version`, (res: any) => {
                resolve(res.statusCode === 200);
            });
            req.setTimeout(1000, () => {
                req.destroy();
                resolve(false);
            });
            req.on('error', () => resolve(false));
        } catch {
            resolve(false);
        }
    });
}

/**
 * Get all open tabs for an account
 */
export function getAccountTabs(account: 'A' | 'B'): Promise<any[]> {
    const debugPort = account === 'A' ? 9222 : 9223;
    const http = require('http');
    
    return new Promise((resolve) => {
        try {
            const req = http.get(`http://localhost:${debugPort}/json`, (res: any) => {
                let data = '';
                res.on('data', (chunk: string) => data += chunk);
                res.on('end', () => {
                    try {
                        const tabs = JSON.parse(data);
                        resolve(tabs.filter((t: any) => t.type === 'page'));
                    } catch {
                        resolve([]);
                    }
                });
            });
            req.setTimeout(2000, () => {
                req.destroy();
                resolve([]);
            });
            req.on('error', () => resolve([]));
        } catch {
            resolve([]);
        }
    });
}
