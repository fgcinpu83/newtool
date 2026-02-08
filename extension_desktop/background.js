// 🔒 ARCHITECTURE GATE
// Governed by:
// - ARSITEKTUR_FINAL.md (Constitution)
// - provider_arsitek.md (Operational Law)
// Any logic here must map to a registered Provider Profile.
// Unauthorized behavior is an architectural violation.
// ============================================================

/**
 * ANTIGRAVITY DESKTOP BRIDGE - BACKGROUND SERVICE WORKER (v3.1 PASSIVE)
 * VERSION: 3.1.0
 */

const CONFIG = {
    BACKEND_URL: 'http://127.0.0.1:3001', // 🛡️ v4.7: Back to 127.0.0.1 (Safest)
    HEARTBEAT_MS: 10000,
    SESSION_CAPTURE_MS: 15000,
    INJECT_INTERVAL_MS: 5000, // 🛡️ v4.4: Forced injection every 5s
    // 🛡️ v3.1 LOCKED - Dynamic SABA Iframe Detection Patterns
    // Regex patterns to detect SABA iframe domains and session paths
    SABA_IFRAME_PATTERNS: {
        // Detects *.aro0061.com, *.aro0062.com, etc.
        DOMAIN_PATTERN: /\.(aro\d*|msy\d*|mgf\d*)\.com/i,
        // Detects /(S(session_id))/ pattern in URL path
        SESSION_PATTERN: /\/\(s\(([^)]+)\)\)/i
    }
};

// ============================================================
// 🛡️ v6.0 SABA TOKEN PERSISTENCE - XHR Interceptor
// Captures Authorization header from /GetOdds requests
// ============================================================
const SABA_TOKEN_KEY = 'SABA_AUTH_TOKEN';
const SABA_TOKEN_TIMESTAMP_KEY = 'SABA_AUTH_TOKEN_TS';
let cachedSabaToken = null;

// Initialize token from storage on startup
chrome.storage.local.get([SABA_TOKEN_KEY, SABA_TOKEN_TIMESTAMP_KEY, 'SNIFFER_CONFIG'], (result) => {
    if (result[SABA_TOKEN_KEY]) {
        cachedSabaToken = result[SABA_TOKEN_KEY];
        const ts = result[SABA_TOKEN_TIMESTAMP_KEY] || 0;
        const ageMinutes = Math.floor((Date.now() - ts) / 60000);
        console.log(`[SABA-TOKEN] 🔑 Loaded cached token (Age: ${ageMinutes}min): ${cachedSabaToken.substring(0, 20)}...`);
    }

    // 🛡️ v7.0 SNIFFER CONFIG INITIALIZATION
    if (!result.SNIFFER_CONFIG) {
        const DEFAULT_CONFIG = {
            sabaKeywords: ['getMatchList', 'getEventList', 'getOdds', 'MatchItems', 'EventItems',
                'LeagueItems', 'HomeName', 'AwayName', 'homeTeam', 'awayTeam',
                'DisplayOdds', 'HDP', 'OddsItems', 'Markets', 'nextmatchid',
                'balance', 'credit', 'ba', 'bl', 'uBal', 'ubal', 'amount', 'Amount'],
            captureLimit: 5000000,
            active: true
        };
        chrome.storage.local.set({ 'SNIFFER_CONFIG': DEFAULT_CONFIG });
    }
});

/**
 * 🛡️ v6.0 SABA Token Interceptor
 * Called when we receive data from content/injected scripts
 * Checks if the request is to /GetOdds and extracts Authorization header
 */
function interceptSabaToken(data) {
    if (!data || !data.url) return;

    const url = (data.url || '').toLowerCase();
    const headers = data.headers || data.data?.headers || {};

    // Check if this is a SABA /GetOdds request
    if (url.includes('/getodds') || url.includes('/odds') || url.includes('/getmatchlist')) {
        // Extract Authorization header (case-insensitive)
        let authToken = null;
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === 'authorization') {
                authToken = headers[key];
                break;
            }
        }

        // Also check common header variations
        if (!authToken) {
            authToken = headers['Authorization'] || headers['authorization'] ||
                headers['X-Auth-Token'] || headers['x-auth-token'] ||
                headers['Bearer'] || headers['token'];
        }

        if (authToken && authToken.length > 10) {
            // Only update if token changed
            if (authToken !== cachedSabaToken) {
                cachedSabaToken = authToken;
                chrome.storage.local.set({
                    [SABA_TOKEN_KEY]: authToken,
                    [SABA_TOKEN_TIMESTAMP_KEY]: Date.now()
                }, () => {
                    console.log(`%c[SABA-TOKEN] 🔐 NEW TOKEN CAPTURED from ${url.substring(0, 50)}`,
                        'background:#4caf50;color:#fff;font-weight:bold');
                    console.log(`[SABA-TOKEN] Token: ${authToken.substring(0, 30)}...`);
                });
            }
        }
    }
}

/**
 * Get the cached SABA token for use in requests
 */
// getSabaToken() removed - token is accessed via chrome.storage or intercept flow

// Helper: determine whether a tab URL should be considered a target.
// Checks stored virtualAccounts.url first, then falls back to heuristics.
function isTabTargetUrl(url, cb) {
    if (!url) return cb(false);
    const low = url.toLowerCase();
    chrome.storage.local.get(['virtualAccounts'], (res) => {
        try {
            const accounts = res.virtualAccounts || [];
            for (const a of accounts) {
                if (a && a.url && a.active) {
                    const part = a.url.toLowerCase();
                    if (part && low.indexOf(part) !== -1) return cb(true);
                }
            }
        } catch (e) { }

        // Fallback heuristics
        const heur = low.includes('saba') || low.includes('qq188') || low.includes('aro') || low.includes('msy') || low.includes('afb') || low.includes('jps9') || low.includes('mpo');
        return cb(heur);
    });
}

// Allow popup to request injection for a saved account explicitly
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'INJECT_ACCOUNT' && msg.account) {
        const acc = msg.account;
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach((t) => {
                try {
                    if (t.url && acc.url && t.url.toLowerCase().indexOf((acc.url || '').toLowerCase()) !== -1) {
                        try { ensureInjected(t.id); } catch (e) { }
                        // Mark tab as active for this account (keep both fields for compatibility)
                        try {
                            activeTabs.set(t.id, { accountId: acc.id, account: acc.id, url: t.url });
                        } catch (e) {}
                    }
                } catch (e) { }
            });
        });
        sendResponse({ ok: true });
        return true;
    }

    // Account toggle handler: inject when active=true, remove/close when false
    if (msg?.type === 'ACCOUNT_TOGGLE' && msg.account) {
        try {
            const acc = msg.account;
            const active = !!msg.active;
            console.log('[AG-DESKTOP] 🔄 ACCOUNT_TOGGLE received:', { id: acc.id, active, url: acc.url, clearConfig: msg.clearConfig });

            if (active) {
                // Inject into matching open tabs
                chrome.tabs.query({}, (tabs) => {
                    try {
                        console.log('[AG-DESKTOP] 📋 Found tabs for injection:', tabs.length);
                        let injectedCount = 0;

                        tabs.forEach((t) => {
                            try {
                                if (t.url && acc.url && t.url.toLowerCase().indexOf((acc.url || '').toLowerCase()) !== -1) {
                                    console.log('[AG-DESKTOP] 🎯 Injecting into tab:', t.id, t.url);
                                    try {
                                        ensureInjected(t.id);
                                        activeTabs.set(t.id, { accountId: acc.id, account: acc.id, url: t.url });
                                        injectedCount++;
                                    } catch (e) {
                                        console.error('[AG-DESKTOP] ❌ ensureInjected failed for tab', t.id, e);
                                    }
                                }
                            } catch (e) {
                                console.error('[AG-DESKTOP] ❌ Tab processing error:', e);
                            }
                        });

                        console.log('[AG-DESKTOP] ✅ Injection complete, injected into', injectedCount, 'tabs');
                        sendResponse({ success: true, injected: injectedCount });
                    } catch (error) {
                        console.error('[AG-DESKTOP] ❌ Tab query error:', error);
                        sendResponse({ success: false, error: error.message });
                    }
                });
                return true; // Will respond asynchronously
            } else {
                console.log('[AG-DESKTOP] 🔄 Deactivating account', acc.id);
                // Deactivate: teardown injected scripts in associated tabs and clear stored provider config
                let teardownCount = 0;
                for (const [tabId, info] of Array.from(activeTabs.entries())) {
                    if (info && info.accountId === acc.id) {
                        try {
                            console.log('[AG-DESKTOP] 🧹 Tearing down injection for tab', tabId);
                            // Instruct content script to forward teardown to page context
                            chrome.tabs.sendMessage(tabId, { type: 'TEARDOWN_INJECTION', accountId: acc.id }).catch(() => {});
                            teardownCount++;
                        } catch (e) {
                            console.error('[AG-DESKTOP] ❌ Teardown message failed for tab', tabId, e);
                        }
                        // Unregister tab from active tracking
                        activeTabs.delete(tabId);
                    }
                }

                console.log('[AG-DESKTOP] ✅ Teardown complete for', teardownCount, 'tabs');
                sendResponse({ success: true, teardown: teardownCount });
            }
        } catch (error) {
            console.error('[AG-DESKTOP] ❌ ACCOUNT_TOGGLE error:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

            // Clear provider-specific configuration and identifying info for this account in storage
            // NOTE: Do NOT change accounts[idx].active = false here - that would override UI state
            // Only clear URL, name, number for cleanup, but preserve UI toggle state
            try {
                chrome.storage.local.get(['virtualAccounts'], (res) => {
                    try {
                        const accounts = res.virtualAccounts || [];
                        const idx = accounts.findIndex(a => a.id === acc.id);
                        if (idx !== -1) {
                            // Only clear provider config, NOT the active state (UI toggle)
                            accounts[idx].url = '';
                            accounts[idx].name = '';
                            accounts[idx].number = '';
                            // accounts[idx].active = false; // REMOVED - Don't override UI state
                            chrome.storage.local.set({ virtualAccounts: accounts }, () => {
                                if (chrome.runtime.lastError) {
                                    console.error('[AG-DESKTOP] ❌ Storage set error:', chrome.runtime.lastError);
                                    return;
                                }
                                console.log('[AG-DESKTOP] 🔄 Cleared provider config for account', acc.id, '(preserved UI state)');

                                // If caller requested a full teardown, perform deeper cleanup
                                if (msg && msg.clearConfig) {
                                    try {
                                        // Clear providerStatuses for this account
                                        chrome.storage.local.get(['providerStatuses'], (r2) => {
                                            try {
                                                const s = r2.providerStatuses || {};
                                                delete s[String(acc.id)];
                                                chrome.storage.local.set({ providerStatuses: s }, () => {
                                                    if (chrome.runtime.lastError) {
                                                        console.error('[AG-DESKTOP] ❌ providerStatuses clear error:', chrome.runtime.lastError);
                                                        return;
                                                    }
                                                    console.log('[AG-DESKTOP] 🧹 providerStatuses entry removed for', acc.id);
                                                });
                                            } catch (e) {
                                                console.error('[AG-DESKTOP] ❌ providerStatuses processing error:', e);
                                            }
                                        });

                                        // Clear cached SABA token and related storage keys
                                        cachedSabaToken = null;
                                        try {
                                            chrome.storage.local.remove([SABA_TOKEN_KEY, SABA_TOKEN_TIMESTAMP_KEY, 'activeProvider'], () => {
                                                if (chrome.runtime.lastError) {
                                                    console.error('[AG-DESKTOP] ❌ Storage remove error:', chrome.runtime.lastError);
                                                }
                                            });
                                        } catch (e) {
                                            console.error('[AG-DESKTOP] ❌ Token cleanup error:', e);
                                        }

                                        // Close offscreen document if present
                                        try {
                                            if (offscreenCreated && chrome.offscreen && chrome.offscreen.closeDocument) {
                                                chrome.offscreen.closeDocument().then(() => {
                                                    offscreenCreated = false;
                                                    console.log('[AG-DESKTOP] 📄 Offscreen document closed');
                                                }).catch((e) => {
                                                    console.error('[AG-DESKTOP] ❌ Offscreen close error:', e);
                                                });
                                            }
                                        } catch (e) {
                                            console.error('[AG-DESKTOP] ❌ Offscreen cleanup error:', e);
                                        }

                                    } catch (e) {
                                        console.error('[AG-DESKTOP] ❌ Deep cleanup error:', e);
                                    }
                                }
                            });
                        } else {
                            console.warn('[AG-DESKTOP] ⚠️ Account not found for cleanup:', acc.id);
                        }
                    } catch (error) {
                        console.error('[AG-DESKTOP] ❌ Account cleanup error:', error);
                    }
                });
            } catch (error) {
                console.error('[AG-DESKTOP] ❌ Storage get error:', error);
            }
                                    try {
                                        if (offscreenCreated && chrome.offscreen && chrome.offscreen.closeDocument) {
                                            chrome.offscreen.closeDocument().then(() => {
                                                offscreenCreated = false;
                                                console.log('[AG-DESKTOP] 🧾 Offscreen document closed during teardown');
                                            }).catch(() => {});
                                        }
                                    } catch (e) { }

                                    // Clear periodic alarms
                                    try { chrome.alarms.clear('heartbeat', () => {}); } catch (e) {}
                                    try { chrome.alarms.clear('capture', () => {}); } catch (e) {}

                                    // Reset in-memory session state
                                    try { activeTabs.clear(); lastOpenedTabs.clear(); bettingTabsCount = 0; } catch (e) {}

                                    // Notify all tabs to perform page/context teardown
                                    try {
                                        chrome.tabs.query({}, (tabsList) => {
                                            for (const t of tabsList || []) {
                                                try { chrome.tabs.sendMessage(t.id, { type: 'GRAVITY_TEARDOWN', accountId: acc.id }); } catch (e) {}
                                            }
                                        });
                                    } catch (e) {}

                                    // Notify UI listeners
                                    try { chrome.runtime.sendMessage({ type: 'PROVIDER_TEARDOWN_COMPLETED', account: acc.id }); } catch (e) {}
                                }
                            } catch (e) { console.warn('[AG-DESKTOP] ⚠️ Teardown step failed', e); }
                        });
                    }
                });
            } catch (e) { console.warn('[AG-DESKTOP] ⚠️ Failed clearing provider config', e); }
        }
        sendResponse({ ok: true });
        return true;
    }
});

// 🛡️ v3.1 LOCKED - Dynamic SABA Iframe Detection
function isSabaIframe(url) {
    if (!url) return false;
    // Check if URL matches SABA domain pattern (*.aro*, *.msy*, *.mgf*)
    if (CONFIG.SABA_IFRAME_PATTERNS.DOMAIN_PATTERN.test(url)) return true;
    // Check if URL contains SABA session path /(S(...))/
    if (CONFIG.SABA_IFRAME_PATTERNS.SESSION_PATTERN.test(url)) return true;
    return false;
}

// Extract session_id from SABA URL pattern /(S(session_id))/
function extractSabaSessionId(url) {
    if (!url) return null;
    const match = url.match(CONFIG.SABA_IFRAME_PATTERNS.SESSION_PATTERN);
    return match ? match[1] : null;
}

// State
let socket = null;
let isConnected = false;
let activeTabs = new Map(); // tabId -> { account, url }

// Cache for injected.js content so we can perform inline fallback injection
let injectedCodeCache = null;

async function getInjectedCode() {
    if (injectedCodeCache) return injectedCodeCache;
    try {
        const url = chrome.runtime.getURL('injected.js');
        const res = await fetch(url);
        const txt = await res.text();
        injectedCodeCache = txt;
        return txt;
    } catch (e) {
        console.warn('[AG-DESKTOP] ⚠️ Failed to fetch injected.js for inline fallback', e);
        return null;
    }
}

// Ensure injected.js is present in the tab. Try file-src injection first; if
// the top-frame remains uninjected (likely due to CSP), fetch the file and
// inject its contents inline into the top frame as a fallback.
async function ensureInjected(tabId) {
    try {
        console.log('[AG-DESKTOP] 🔧 Starting injection for tab', tabId);
        // First attempt: inject by adding <script src="..."> into all frames
        await chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            func: () => {
                try {
                    if (window.__GRAVITY_INJECTED__) return;
                    window.__GRAVITY_INJECTED__ = true;
                    const s = document.createElement('script');
                    s.src = chrome.runtime.getURL('injected.js');
                    s.onload = function () { this.remove(); };
                    (document.head || document.documentElement).appendChild(s);
                } catch (e) { }
            }
        });

        // Small delay then verify top-frame injection; if not injected, fallback
        setTimeout(async () => {
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tabId, allFrames: false },
                    func: () => { return !!window.__GRAVITY_INJECTED__; }
                });

                const injectedTop = Array.isArray(results) ? results.some(r => r && r.result) : (results && results.result);
                if (injectedTop) {
                    console.log('[AG-DESKTOP] ✅ Injection successful for tab', tabId);
                    return;
                }

                console.log('[AG-DESKTOP] ⚠️ File injection failed, trying fallback for tab', tabId);
                // Fallback: inline injection of script text into top frame
                const code = await getInjectedCode();
                if (!code) {
                    console.error('[AG-DESKTOP] ❌ No injected code available for fallback');
                    return;
                }

                await chrome.scripting.executeScript({
                    target: { tabId: tabId, allFrames: false },
                    func: (source) => {
                        try {
                            if (window.__GRAVITY_INJECTED__) return;
                            const s = document.createElement('script');
                            s.textContent = source;
                            (document.head || document.documentElement).appendChild(s);
                            window.__GRAVITY_INJECTED__ = true;
                        } catch (e) { }
                    },
                    args: [code]
                });
                console.log('[AG-DESKTOP] ✅ Fallback injection successful for tab', tabId);
            } catch (e) {
                console.warn('[AG-DESKTOP] ⚠️ verify/fallback injection failed for tab', tabId, e);
            }
        }, 400);
    } catch (e) {
        console.warn('[AG-DESKTOP] ⚠️ ensureInjected failed for tab', tabId, e);
    }
}

// ============================================================
// OFFSCREEN DOCUMENT MANAGEMENT (v9.9 Robust)
// ============================================================
let offscreenCreated = false;

async function setupOffscreen() {
    // 🛡️ v9.9: Always check actual state, not just flag
    try {
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT']
        });

        if (existingContexts.length > 0) {
            offscreenCreated = true;
            console.log('[AG-DESKTOP] 📄 Offscreen document already exists (found via getContexts)');
            return;
        }
    } catch (e) {
        console.warn('[AG-DESKTOP] ⚠️ getContexts failed, trying to create anyway:', e.message);
    }

    // 🛡️ v9.9: Close any existing offscreen first to prevent conflicts
    try {
        await chrome.offscreen.closeDocument();
        console.log('[AG-DESKTOP] 🧹 Closed stale offscreen document');
    } catch (e) {
        // Expected if no document exists - ignore
    }

    // Small delay to ensure cleanup
    await new Promise(r => setTimeout(r, 100));

    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['BLOBS'], // 🛡️ v9.9: BLOBS is more permissive than MATCH_MEDIA
            justification: 'Maintaining a stable WebSocket connection for real-time arbitrage data.'
        });
        offscreenCreated = true;
        console.log('[AG-DESKTOP] ✅ Offscreen document created successfully');
    } catch (err) {
        if (err.message && err.message.includes('single offscreen')) {
            // Already exists - mark as created
            offscreenCreated = true;
            console.log('[AG-DESKTOP] 📄 Offscreen already exists (caught in create)');
        } else {
            console.error('[AG-DESKTOP] ❌ Failed to create offscreen document:', err);
        }
    }
}

// Proxy messages from offscreen script
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'OFFSCREEN_STATUS') {
        isConnected = msg.connected;
        chrome.runtime.sendMessage({ type: 'STATUS', connected: isConnected }).catch(() => { });
    }

    if (msg.type === 'BACKEND_COMMAND') {
        handleBackendCommand(msg.event, msg.data);
    }
});

// ============================================================
// SESSION MANAGEMENT - Auto-reset provider config on session close
// ============================================================

// Reset provider config when all betting tabs are closed
function resetProviderConfig() {
    console.log('[AG-DESKTOP] 🔄 Auto-resetting provider config (session closed)');
    chrome.storage.local.remove(['activeProvider'], () => {
        if (chrome.runtime.lastError) {
            console.warn('[AG-DESKTOP] ⚠️ Failed to reset provider config:', chrome.runtime.lastError);
        } else {
            console.log('[AG-DESKTOP] ✅ Provider config reset successfully');
        }
    });
}

// Track betting tabs
let bettingTabsCount = 0;

function updateBettingTabsCount() {
    chrome.tabs.query({}, (tabs) => {
        let count = 0;
        for (const tab of tabs) {
            const url = (tab.url || '').toLowerCase();
            // Count tabs with betting site URLs
            if (url.includes('qq188') || url.includes('saba') || url.includes('afb') ||
                url.includes('jps9') || url.includes('mpo') || url.includes('prosportslive') ||
                url.includes('cmd368') || url.includes('aro') || url.includes('msy')) {
                count++;
            }
        }

        // Reset config if no betting tabs remain
        if (bettingTabsCount > 0 && count === 0) {
            resetProviderConfig();
        }

        bettingTabsCount = count;
        console.log(`[AG-DESKTOP] 📊 Betting tabs count: ${count}`);
    });
}

// Listen for tab close events
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log(`[AG-DESKTOP] 🗑️ Tab closed: ${tabId}`);
    // Delay check to allow for tab updates
    setTimeout(updateBettingTabsCount, 1000);
});

// Listen for tab URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        updateBettingTabsCount();
    }
});

// Check on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('[AG-DESKTOP] 🚀 Browser startup - resetting provider config');
    resetProviderConfig();
    updateBettingTabsCount();
});

// Reset on extension suspend (browser close)
chrome.runtime.onSuspend.addListener(() => {
    console.log('[AG-DESKTOP] 💤 Extension suspending - resetting provider config');
    resetProviderConfig();
});

// Re-init offscreen on startup
chrome.runtime.onStartup.addListener(setupOffscreen);
chrome.runtime.onInstalled.addListener(setupOffscreen);
setupOffscreen();

// ============================================================
// HANDLE BACKEND COMMANDS
// ============================================================
const lastOpenedTabs = new Map();

function handleBackendCommand(event, data) {
    console.log(`[AG-DESKTOP] 📩 Backend Command: ${event}`, data);

    // Handle provider status updates from backend and persist to storage
    if (event === 'provider_status' && data && data.account) {
        try {
            const account = String(data.account);
            const provider = data.provider || 'UNKNOWN';
            const status = (data.status || '').toString().toLowerCase();

            // Map backend statuses to lamp states: 'on' | 'warn' | 'off'
            let lampState = 'off';
            if (status === 'online' || status === 'ok' || status === 'active') lampState = 'on';
            else if (status === 'warn' || status === 'degraded' || status === 'slow') lampState = 'warn';
            else lampState = 'off';

            chrome.storage.local.get(['providerStatuses'], (res) => {
                const statuses = res.providerStatuses || {};
                // write primary provider slot (slotIndex:0)
                statuses[account] = statuses[account] || {};
                statuses[account].primary = {
                    slotIndex: 0,
                    state: lampState,
                    label: provider
                };
                chrome.storage.local.set({ providerStatuses: statuses }, () => {
                    console.log('[AG-DESKTOP] 🔁 providerStatuses updated for', account, provider, lampState);
                    // Notify UI listeners that statuses changed
                    try { chrome.runtime.sendMessage({ type: 'PROVIDER_STATUSES_UPDATED', account, provider, state: lampState }); } catch (e) {}
                });
            });
        } catch (err) {
            console.warn('[AG-DESKTOP] ⚠️ Failed handling provider_status', err);
        }
        return;
    }

    // 🛡️ v5.3: Unified Automation Handler (EXECUTE_AUTOMATION)
    if (event === 'EXECUTE_AUTOMATION' || event === 'browser:open') {
        const account = data.account;
        const url = (data.url || '').trim();

        if (!url) {
            console.warn(`[AG-DESKTOP] ⚠️ No URL provided for ${account}`);
            return;
        }

        console.log(`[AG-DESKTOP] 🌐 Executing automation for ${account}: ${url}`);

        // 🛡️ v5.3: Efficiency Check - Domain Matching
        const targetDomain = new URL(url).hostname.replace('www.', '');
        const now = Date.now();

        // 🕵️ DEDUPLICATION: Better matching by base URL
        const baseUrl = url.split('?')[0].split('#')[0];

        chrome.tabs.query({}, (tabs) => {
            const existingTab = tabs.find(t => t.url && t.url.includes(baseUrl));

            if (existingTab) {
                console.log(`[AG-DESKTOP] 🛡️ Tab already exists (${existingTab.id}). Updating/Focusing.`);
                chrome.tabs.update(existingTab.id, { url: url, active: true });
                activeTabs.set(existingTab.id, { account: account, url: url });
                lastOpenedTabs.set(account, { url, timestamp: now });
            } else {
                console.log(`[AG-DESKTOP] ✨ Creating new tab for ${account}: ${baseUrl}`);
                chrome.tabs.create({ url: url, active: true }, (tab) => {
                    activeTabs.set(tab.id, { account: account, url: url });
                    lastOpenedTabs.set(account, { url, timestamp: now });
                });
            }
        });
        return;
    }

    if (event === 'browser:close') {
        const account = data.account;
        console.log(`[AG-DESKTOP] 🚫 Closing tabs for ${account}`);
        for (const [tabId, info] of activeTabs.entries()) {
            if (info.account === account) {
                chrome.tabs.remove(tabId);
            }
        }
        resetAccountContext(account);
        return;
    }

    // 🛡️ v4.1 LOCKED - Generic Browser Command Forwarder
    // 🛡️ v4.3 FORCE RELOAD / RE-INJECTION
    if (event === 'browser:command' && (data.command === 'RELOAD_EXTENSION' || data.command === 'RELOAD_TAB')) {
        console.log('[AG-DESKTOP] 🔄 Executing RELOAD_EXTENSION protocol');
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                const url = (tab.url || '').toLowerCase();
                if (url.includes('saba') || url.includes('qq188') || url.includes('aro') || url.includes('msy') || url.includes('afb')) {
                    chrome.tabs.reload(tab.id);
                }
            });
        });
    }

    // Forward to specific account tabs or all
    for (const [tabId, info] of activeTabs.entries()) {
        if (!data.account || data.account === 'ALL' || info.account === data.account) {
            chrome.tabs.sendMessage(tabId, data).catch(() => { });
        }
    }

    // Broad fallback for manual logins (detect by URL)
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            const url = (tab.url || '').toLowerCase();
            const isTarget = url.includes('saba') || url.includes('qq188') ||
                url.includes('aro') || url.includes('msy') ||
                url.includes('afb') || url.includes('jps9') || url.includes('mpo');

            if (isTarget) {
                chrome.tabs.sendMessage(tab.id, data).catch(() => { });
            }
        });
    });
}

// hardResetContext removed — state cleared via specific helpers when needed

function resetAccountContext(account) {
    for (const [tabId, info] of activeTabs.entries()) {
        if (info.account === account) {
            activeTabs.delete(tabId);
        }
    }
    lastOpenedTabs.delete(account);
}

// ============================================================
// PACKET SENDER
// ============================================================
function sendPacket(type, data, account = null) {
    // 🛡️ v9.6 FIX: Use multiple URL sources for detection (frameUrl, url, or full path)
    const dataUrl = (data.url || '').toLowerCase();
    const frameUrl = (data.frameUrl || '').toLowerCase();
    // Combine both for better pattern matching
    const urlForDetection = frameUrl.length > dataUrl.length ? frameUrl : dataUrl;

    // 🛡️ v4.5 CRITICAL FIX: URL-based Account Detection
    // If account is not A or B, detect from URL patterns
    if (!account || account === 'DESKTOP' || !['A', 'B'].includes(account)) {
        // AFB88 patterns -> Account A
        const isAfb88Url = urlForDetection.includes('jps9') || urlForDetection.includes('mpo1221') ||
            urlForDetection.includes('prosportslive') || urlForDetection.includes('wsfev2') ||
            urlForDetection.includes('afb88') || urlForDetection.includes('linkcdn') ||
            urlForDetection.includes('mpo') || dataUrl.includes('/pgmain') || dataUrl.includes('/pgbetodds');

        // ISPORT/SABA patterns -> Account B
        const isIsportUrl = urlForDetection.includes('qq188') || urlForDetection.includes('aro0') ||
            urlForDetection.includes('msy') || urlForDetection.includes('mgf') ||
            urlForDetection.includes('saba') || urlForDetection.includes('b8d6') ||
            urlForDetection.includes('lvx3306') || urlForDetection.includes('vpe8557') ||
            urlForDetection.includes('lcvc092n');

        if (isAfb88Url) {
            account = 'A';
            console.log(`[AG-DESKTOP] 🎯 URL matched AFB88 -> Account A: ${urlForDetection.substring(0, 40)}`);
        } else if (isIsportUrl) {
            account = 'B';
            console.log(`[AG-DESKTOP] 🎯 URL matched ISPORT -> Account B: ${urlForDetection.substring(0, 40)}`);
        } else {
            // Keep as DESKTOP for truly unknown traffic
            account = 'DESKTOP';
        }
    }

    // 🛡️ v3.2 FIX: Auto-register tabs when we receive data from them
    // This allows manual logins to work (not just backend-opened tabs)
    if (data.tabId && data.tabId !== 'SELF' && !activeTabs.has(data.tabId)) {
        // Auto-register this tab for future tracking
        activeTabs.set(data.tabId, {
            account: account,
            url: data.url || ''
        });
        console.log(`[AG-DESKTOP] 📝 Auto-registered tab ${data.tabId} for account ${account}`);
    } else if (data.tabId && data.tabId !== 'SELF' && activeTabs.has(data.tabId)) {
        // Update existing tab with detected account if it was DESKTOP
        const existing = activeTabs.get(data.tabId);
        if (existing.account === 'DESKTOP' && account !== 'DESKTOP') {
            existing.account = account;
            console.log(`[AG-DESKTOP] 🔄 Updated tab ${data.tabId} to account ${account}`);
        }
    }

    // 🔒 v3.1 FIX: Preserve URL at top level for classifier
    // 🛡️ v3.1 LOCKED - Cross-Frame Session Support
    const packetFrameUrl = data.frameUrl || data.url || '';
    const isIframe = data.isIframe || false;

    // 🛡️ v3.1 LOCKED - Dynamic SABA Iframe Detection with Regex
    const isSabaFrame = isSabaIframe(packetFrameUrl);
    const sabaSessionId = extractSabaSessionId(packetFrameUrl);

    // Log SABA iframe traffic with extracted session
    const payloadSize = data.size || (data.responseBody ? data.responseBody.length : 0);
    if (isSabaFrame || sabaSessionId) {
        console.log(`[AG-DESKTOP] 🖼️ SABA Traffic detected | Size: ${payloadSize} bytes | Session: ${sabaSessionId || 'N/A'} | URL: ${packetFrameUrl.substring(0, 40)}...`);

        // 🔥 v7.9 STRUCTURE DISCOVERY (Background)
        if (data.responseBody && (data.responseBody.startsWith('{') || data.responseBody.startsWith('['))) {
            try {
                const obj = JSON.parse(data.responseBody);
                const rootKeys = Array.isArray(obj) ? 'ARRAY' : Object.keys(obj);
                console.log(`%c[DISCOVERY-BG] Root Keys: ${JSON.stringify(rootKeys)}`, 'color:#ffa500;background:#111');
            } catch (e) { }
        }
    }

    const packet = {
        account: account, // Now properly set to A, B, or DESKTOP
        provider: 'PASSIVE_SENSOR', // v3.1: Provider is identified by backend
        type: type,
        url: data.url || '', // 🔥 TOP-LEVEL URL for classifier
        frameUrl: packetFrameUrl,  // 🛡️ Frame URL for session extraction
        isIframe: isIframe,  // 🛡️ Flag indicating data from iframe
        isSabaFrame: isSabaFrame,  // 🛡️ Dynamic SABA iframe detection
        sabaSessionId: sabaSessionId,  // 🛡️ Extracted session_id from URL
        tabId: data.tabId || null,
        clientId: data.clientId || null, // 🛡️ v7.5: Deterministic Client ID
        data: {
            ...data,
            url: data.url || '', // Also in data for compatibility
            frameUrl: packetFrameUrl,
            isIframe: isIframe,
            isSabaFrame: isSabaFrame,
            sabaSessionId: sabaSessionId,
            responseBody: data.responseBody || null,
            requestBody: data.requestBody || null,
            headers: data.headers || {},
            method: data.method || 'GET',
            status: data.status || 200
        },
        timestamp: Date.now(),
        source: 'DESKTOP_EXTENSION_OFFSCREEN'
    };

    chrome.runtime.sendMessage({
        type: 'SEND_PACKET',
        packet: packet
    }).catch(() => {
        // If offscreen isn't ready, try to restart it
        setupOffscreen();
    });

    return true;
}

// ============================================================
// SESSION CAPTURE (PASSIVE)
// ============================================================
async function captureSession(tabId, url) {
    if (!activeTabs.has(tabId)) return;

    const info = activeTabs.get(tabId);
    let cookies = [];
    try {
        const urlObj = new URL(url);
        cookies = await chrome.cookies.getAll({ domain: urlObj.hostname });
    } catch (e) { return; }

    const sessionData = {
        url: url,
        domain: new URL(url).hostname,
        tabId: tabId,
        cookies: cookies.map(c => `${c.name}=${c.value}`).join('; '),
        cookieCount: cookies.length,
        userAgent: navigator.userAgent
    };

    sendPacket('session_capture', sessionData, info.account);
}

// ============================================================
// TAB MONITORING
// ============================================================
chrome.tabs.onCreated.addListener((tab) => {
    if (tab.openerTabId && activeTabs.has(tab.openerTabId)) {
        const parentInfo = activeTabs.get(tab.openerTabId);
        activeTabs.set(tab.id, {
            account: parentInfo.account,
            url: tab.url
        });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        captureSession(tabId, tab.url);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    activeTabs.delete(tabId);
});

// ============================================================
// MESSAGE HANDLER
// ============================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.tabId === 'SELF' && sender.tab) {
        msg.tabId = sender.tab.id;
        if (!activeTabs.has(msg.tabId)) {
            activeTabs.set(msg.tabId, {
                account: msg.account || 'DESKTOP',
                url: msg.url || sender.tab.url
            });
        }
    }

    const tabId = sender.tab?.id;
    const info = tabId ? activeTabs.get(tabId) : null;
    const account = info?.account || msg.account || 'DESKTOP';

    // 🛡️ v6.0 SABA TOKEN INTERCEPTOR - Capture Authorization from /GetOdds
    // Process ALL incoming messages to extract SABA tokens
    interceptSabaToken(msg);

    if (msg.type === 'SESSION_DATA') {
        sendPacket('session_capture', msg, account);
    }

    // v3.1: Support both legacy uppercase and new lowercase format
    if (msg.type === 'API_AUDIT' || msg.type === 'API_CONTRACT_RECORDER' || msg.type === 'api_contract_recorder') {
        let type = msg.type === 'API_AUDIT' ? 'contract_audit' : 'api_contract_capture';

        // 🛡️ v6.0: Also intercept token from contract captures
        interceptSabaToken(msg);

        sendPacket(type, msg, account);
    }

    if (msg.type === 'GET_STATUS') {
        sendResponse({ connected: isConnected, sabaToken: cachedSabaToken ? 'CACHED' : 'NONE' });
    }

    // 🛡️ v7.0 MV3 KEEP-ALIVE: Dashboard Ping
    if (msg.type === 'DASHBOARD_PING') {
        // console.log('[KEEP-ALIVE] 💓 Received Ping from Dashboard');
        sendResponse({ status: 'PONG', ts: Date.now() });
        // Doing work inside a message handler helps keep the SW alive
        chrome.storage.local.get(['SW_LIVENESS'], () => {
            chrome.storage.local.set({ 'SW_LIVENESS': Date.now() });
        });
        return true; // Keep channel open for async response
    }
});

// ============================================================
// ALARMS
// ============================================================
chrome.alarms.create('heartbeat', { periodInMinutes: 0.17 });
chrome.alarms.create('capture', { periodInMinutes: 0.25 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'heartbeat') {
        sendPacket('heartbeat', {
            status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
            activeTabs: activeTabs.size
        });
    }

    if (alarm.name === 'capture') {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url && activeTabs.has(tab.id)) {
                    captureSession(tab.id, tab.url);
                }
            });
        });
    }
});

// ============================================================
// 🛡️ v4.3 X-FRAME & CSP BYPASS (MV3)
// ============================================================
async function setupBypassRules() {
    if (!chrome.declarativeNetRequest) return;

    const rules = [
        {
            id: 1,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                responseHeaders: [
                    { header: 'x-frame-options', operation: 'remove' },
                    { header: 'content-security-policy', operation: 'remove' },
                    { header: 'frame-options', operation: 'remove' }
                ]
            },
            condition: {
                urlFilter: '*',
                resourceTypes: ['sub_frame', 'main_frame']
            }
        }
    ];

    try {
        const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
        const oldRuleIds = oldRules.map(r => r.id);
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: oldRuleIds,
            addRules: rules
        });
        console.log('[AG-DESKTOP] 🔓 X-Frame/CSP Bypass Rules ACTIVE');
    } catch (e) {
        console.error('[AG-DESKTOP] ❌ Failed to set bypass rules:', e);
    }
}

// ============================================================
// 🛡️ v4.4 DIRECT DOM INJECTION (OVERDRIVE)
// ============================================================
// performForcedInjection() removed — replaced by periodic overdrive loops below

// Start periodic overdrive - 🛡️ v5.0: Reduced from 5s to 30s to prevent zombie scripts
// Also using injectedTabs Map to track which tabs already have injected.js
const injectedTabs = new Set();
const injectedFrames = new Set(); // 🛡️ v5.3: Track frames separately

setInterval(() => {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            // Skip if already injected in this session
            if (injectedTabs.has(tab.id)) return;

            const url = (tab.url || '').toLowerCase();

            // 🛡️ v4.7 BLOCKED DOMAINS - Never inject into these
            const isBlocked = url.includes('livechat') ||
                url.includes('tawk.to') ||
                url.includes('zendesk') ||
                url.includes('intercom') ||
                url.includes('freshdesk') ||
                url.includes('crisp') ||
                url.includes('olark') ||
                url.includes('helpscout') ||
                url.includes('messenger') ||
                url.includes('whatsapp');

            if (isBlocked) return;

            // Check against stored accounts first, then fallback heuristics
            isTabTargetUrl(url, (isTarget) => {
                if (!isTarget || !tab.id) return;
                injectedTabs.add(tab.id);
                sendPacket('session_capture', { url: tab.url, manual: true }, tab.id);

                chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    func: () => {
                        if (window.__GRAVITY_INJECTED__) return;
                        window.__GRAVITY_INJECTED__ = true;

                        const s = document.createElement('script');
                        s.src = chrome.runtime.getURL('injected.js');
                        s.onload = function () { this.remove(); };
                        (document.head || document.documentElement).appendChild(s);
                        console.log('[OVERDRIVE] 🚀 Forced injected.js into frame');
                    }
                }).catch(() => { });
            });
        });
    });
}, 30000); // v5.0: Changed from 5000ms to 30000ms

// 🛡️ v5.3 AGGRESSIVE ISPORT/SABA IFRAME INJECTION
// This runs every 5 seconds specifically for ISPORT tabs to catch late-loading iframes
setInterval(() => {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            const url = (tab.url || '').toLowerCase();

            // Only target ISPORT/QQ188/SABA tabs
            const isIsportTab = url.includes('qq188') || url.includes('aro') ||
                url.includes('msy') || url.includes('mgf') || url.includes('saba') ||
                url.includes('b8d6') || url.includes('lvx3306');

            if (isIsportTab && tab.id) {
                // Force inject into ALL frames every time
                    try { ensureInjected(tab.id); } catch (e) {}
            }
        });
    });
}, 5000); // 🛡️ v5.3: Run every 5 seconds for ISPORT tabs

// ============================================================
// 🔥 v6.1 FORCE-FLOW INJECTION - Auto-Scroll for ISPORT
// Triggers lazy-load content every 10 seconds
// ============================================================
setInterval(() => {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            const url = (tab.url || '').toLowerCase();

            // Only target ISPORT/QQ188/SABA tabs
            const isIsportTab = url.includes('qq188') || url.includes('aro') ||
                url.includes('msy') || url.includes('mgf') || url.includes('saba') ||
                url.includes('b8d6') || url.includes('lvx3306');

            if (isIsportTab && tab.id) {
                // Execute auto-scroll in all frames
                chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    func: () => {
                        // Auto-scroll to trigger lazy-load
                        const scrollTarget = document.querySelector('.match-list, .sports-content, .event-list, #sportsFrame, .main-content') ||
                            document.body;

                        if (scrollTarget) {
                            const currentScroll = scrollTarget.scrollTop || window.scrollY;
                            const maxScroll = scrollTarget.scrollHeight || document.body.scrollHeight;

                            // Scroll down by 500px or wrap around if at bottom
                            const newScroll = currentScroll + 500;
                            if (newScroll >= maxScroll - window.innerHeight) {
                                // Reset to top if near bottom
                                scrollTarget.scrollTop = 0;
                                window.scrollTo(0, 0);
                            } else {
                                scrollTarget.scrollTop = newScroll;
                                window.scrollTo(0, newScroll);
                            }

                            console.log(`%c[AUTO-SCROLL] 📜 Scrolled ISPORT content (${currentScroll} -> ${newScroll})`, 'color:#0ff');
                        }
                    }
                }).catch(() => { });
            }
        });
    });
}, 10000); // Run every 10 seconds

// Clean up injectedTabs when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    injectedTabs.delete(tabId);
});

console.log('[AG-DESKTOP] 🚀 Gravity v7.4 Active (Offscreen Persistence Enabled)');
setupBypassRules();
setupOffscreen();

