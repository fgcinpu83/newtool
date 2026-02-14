// 🔒 ARCHITECTURE GATE
// Governed by:
// - ARSITEKTUR_FINAL.md (Constitution)
// - provider_arsitek.md (Operational Law)
// Any logic here must map to a registered Provider Profile.
// Unauthorized behavior is an architectural violation.
// ============================================================

// 🛡️ v4.7 EARLY EXIT: Do NOT run on non-betting pages
const currentUrl = location.href.toLowerCase();
const currentHost = location.hostname.toLowerCase();

// Block list: LiveChat, Support, and other non-betting domains
const BLOCKED_DOMAINS = [
    'livechat',
    'livechatinc.com',
    'tawk.to',
    'zendesk',
    'intercom',
    'freshdesk',
    'crisp.chat',
    'olark',
    'purechat',
    'kayako',
    'helpscout',
    'support',
    'chat.google',
    'facebook.com',
    'messenger',
    'whatsapp'
];

const isBlockedPage = BLOCKED_DOMAINS.some(blocked =>
    currentHost.includes(blocked) || currentUrl.includes(blocked)
);

if (isBlockedPage) {
    console.log(`%c[GRAVITY] 🚫 BLOCKED DOMAIN - Skipping all logic: ${currentHost}`,
        'background:#f00;color:#fff;font-size:12px;');
    // Early return - do nothing on blocked domains
    throw new Error('GRAVITY_BLOCKED_DOMAIN'); // This stops script execution cleanly
}

console.log(`%c[GRAVITY-RECORDER] 📡 PASSIVE SENSOR INJECTED: ${location.href} (Frame: ${window.self !== window.top ? 'IFRAME' : 'TOP'})`,
    'background:#f00;color:#fff;font-size:16px;font-weight:bold;'
);

// Global traffic tracker for token renewal
window.lastGravityTraffic = Date.now();
// 🛡️ v6.0: Navigation variables removed - now exclusively in injected.js

(function () {

    const IS_SHADOW = window.self !== window.top;
    if (IS_SHADOW) {
        console.log('[GRAVITY] 👻 Running in SHADOW MODE (Network Capture only)');
    }

    // ---------- SAFE SEND ----------
    function safeSendMessage(payload) {
        try {
            if (chrome.runtime && chrome.runtime.id) {
                // v3.1 Guard: Ensure every packet has tabId context
                if (typeof payload === 'object' && !payload.tabId) {
                    payload.tabId = 'SELF';
                }
                chrome.runtime.sendMessage(payload);
            }
        } catch (e) {
            if (String(e).includes("invalidated")) {
                console.warn("[GRAVITY-RECORDER] Context invalidated. Stopping.");
            }
        }
    }

    // ---------- INJECTED SCRIPT LOADER ----------
    function injectScript() {
        if (document.getElementById('gravity-injected-script')) return;

        const script = document.createElement('script');
        script.id = 'gravity-injected-script';
        script.src = chrome.runtime.getURL('injected.js');
        script.onload = () => {
            console.log('[GRAVITY-CONTENT] ✅ Injected script loaded successfully');

            // 🛡️ v8.1 SEND SETTINGS TO INJECTED SCRIPT
            setTimeout(() => {
                chrome.storage.local.get(['activeProvider', 'ACTIVE_ACCOUNT', 'virtualAccounts'], (result) => {
                    const settings = {
                        type: 'GRAVITY_SETTINGS',
                        activeProvider: result.activeProvider || null,
                        activeAccount: result.ACTIVE_ACCOUNT || 'A',
                        virtualAccounts: result.virtualAccounts || []
                    };

                    // Send to all frames
                    window.postMessage(settings, '*');
                    if (window.frames) {
                        for (let i = 0; i < window.frames.length; i++) {
                            try {
                                window.frames[i].postMessage(settings, '*');
                            } catch (e) {}
                        }
                    }

                    console.log('[GRAVITY-CONTENT] 📤 Sent settings to injected script:', settings);
                });
            }, 100); // Small delay to ensure injected script is ready
        };
        script.onerror = (err) => {
            console.error('[GRAVITY-CONTENT] ❌ Failed to load injected script:', err);
        };

        // Inject at the beginning of head to capture early network requests
        const head = document.head || document.documentElement;
        head.insertBefore(script, head.firstChild);
    }

    // Network interception is handled by injected.js (defined below)

    // ---------- HUD ----------
    let hudElement = null;
    let trafficActive = false;

    function createHUD() {
        if (document.getElementById('ag-hud')) return;

        const bar = document.createElement('div');
        bar.id = 'ag-bar';
        bar.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:6px;background:red;z-index:2147483647;transition:background 0.5s;';
        document.documentElement.appendChild(bar);

        const hud = document.createElement('div');
        const url = location.href.toLowerCase();

        // Provider detection: prefer explicit virtualAccounts stored in extension
        let provName = 'DETECTING';
        try {
            chrome.storage.local.get(['virtualAccounts'], (res) => {
                const accounts = res.virtualAccounts || [];
                let matched = null;
                for (const a of accounts) {
                    if (!a || !a.url) continue;
                    const part = a.url.toLowerCase();
                    if (part && url.indexOf(part) !== -1) {
                        matched = a.providerType || matched;
                        break;
                    }
                }

                if (matched) {
                    if (matched.toUpperCase().includes('ISPORT') || matched.toUpperCase().includes('SABA')) provName = 'ISPORT/SABA';
                    else if (matched.toUpperCase().includes('AFB')) provName = 'AFB88';
                    else provName = matched.toUpperCase();
                } else {
                    // Fallback heuristics
                    const isIport = url.includes('aro') || url.includes('msy') || url.includes('mgf') || url.includes('qq188') || url.includes('saba');
                    const isAfb = url.includes('afb') || url.includes('jps9') || url.includes('mpo');
                    if (isIport) provName = 'ISPORT/SABA';
                    else if (isAfb) provName = 'AFB88';
                    else provName = 'DETECTING';
                }
                // Update HUD text once provider determined
                if (hudElement) hudElement.textContent = `🔴 GRAVITY: ${provName} (${window.self !== window.top ? 'FRAME' : 'MAIN'})`;
            });
        } catch (e) {
            // fallback to heuristics
            const isIport = url.includes('aro') || url.includes('msy') || url.includes('mgf') || url.includes('qq188') || url.includes('saba');
            const isAfb = url.includes('afb') || url.includes('jps9') || url.includes('mpo');
            if (isIport) provName = 'ISPORT/SABA';
            else if (isAfb) provName = 'AFB88';
        }

        hud.id = 'ag-hud';
        hudElement = hud;
        hud.style.cssText = 'position:fixed;bottom:20px;right:20px;background:red;color:white;padding:12px 18px;font-size:16px;font-weight:900;border:3px solid white;border-radius:8px;z-index:2147483647;box-shadow: 0 0 20px rgba(0,0,0,0.5);transition:background 0.5s;';
        hud.textContent = `🔴 GRAVITY: ${provName} (${window.self !== window.top ? 'FRAME' : 'MAIN'})`;
        document.documentElement.appendChild(hud);

        // 🛡️ v7.5 MESSAGE BRIDGE: Listen for injected.js data and attach user-selected provider
        window.addEventListener('message', (event) => {
            // Only accept messages from same origin and with gravity contract
            if (event.source !== window || !event.data || !event.data.__GRAVITY_CONTRACT__) {
                return;
            }

            try {
                // Attach user-chosen provider from storage (manual selection wins)
                chrome.storage.local.get(['activeProvider'], (res) => {
                    const payload = Object.assign({}, event.data);
                    const userProvider = (res && res.activeProvider) ? res.activeProvider : null;
                    if (userProvider && userProvider !== 'Not configured') {
                        // Normalize provider naming to backend expectation
                        payload.provider = userProvider.toUpperCase();
                    }

                    console.log('[GRAVITY-CONTENT] 📨 Received contract from injected.js:', payload.type);
                    // Forward to background service worker with provider hint
                    chrome.runtime.sendMessage(payload).catch(err => {
                        console.warn('[GRAVITY-CONTENT] ⚠️ Failed to send message to background:', err);
                    });
                });
            } catch (e) {
                // Fallback: forward original
                chrome.runtime.sendMessage(event.data).catch(() => {});
            }
        });

        // Update HUD color based on traffic activity
        setInterval(() => {
            const timeSinceTraffic = Date.now() - (window.lastGravityTraffic || 0);
            const hasRecentTraffic = timeSinceTraffic < 15000; // 15 seconds

            const bar = document.getElementById('ag-bar');
            if (hasRecentTraffic) {
                if (!trafficActive) {
                    trafficActive = true;
                    hud.style.background = '#22c55e'; // Green
                    hud.textContent = `🟢 GRAVITY: ${provName} (ACTIVE)`;
                    if (bar) bar.style.background = '#22c55e';
                }
            } else {
                if (trafficActive) {
                    trafficActive = false;
                    hud.style.background = '#f59e0b'; // Orange/Yellow
                    hud.textContent = `🟡 GRAVITY: ${provName} (IDLE)`;
                    if (bar) bar.style.background = '#f59e0b';
                }
            }
        }, 2000);
    }

    // ---------- INJECT NETWORK HOOK ----------
    function interceptNetwork() {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL('injected.js');
        s.onload = function () {
            console.log('[GRAVITY-RECORDER] injected.js mounted');
            this.remove();
        };
        (document.head || document.documentElement).appendChild(s);

        window.addEventListener('message', function (event) {
            // Forward contract data
            if (event.data && event.data.__GRAVITY_CONTRACT__) {
                window.lastGravityTraffic = Date.now();
                safeSendMessage(event.data);
            }

            // 🛡️ v7.0 MV3 KEEP-ALIVE: Forward dashboard ping
            if (event.data && event.data.type === 'DASHBOARD_PING') {
                safeSendMessage({ type: 'DASHBOARD_PING', ts: Date.now() });
            }
        });

        // 🛡️ v7.0 HOT-RELOADING: Listen for config changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.SNIFFER_CONFIG) {
                console.log('[GRAVITY-CONTENT] 🔄 Hot-Reloading Sniffer Config...');
                window.postMessage({
                    type: 'CONFIG_UPDATE',
                    config: changes.SNIFFER_CONFIG.newValue
                }, '*');
            }
        });
    }

    // ---------- PING (FORENSIC) ----------
    function forensicPing() {
        safeSendMessage({
            type: 'API_AUDIT',
            url: location.href,
            title: document.title,
            cookies: document.cookie.length,
            ts: Date.now()
        });
    }

    // 🛡️ v5.2 PASSIVE OBSERVER MODE TIMESTAMP
    const PASSIVE_MODE_UNTIL = 1768983067000; // Epoch for 2026-01-21T15:11:00+07:00 (1 hour from now)

    // ---------- ACTIVATOR (Class C/AFB88 Style) ----------
    // Activator is an Extension role for Class C (EVENT_DRIVEN)
    // Ref: provider_arsitek.md Section 5
    function runActivator() {
        // v3.1: Activator still runs but it doesn't "select" provider.
        // It just interacts with common patterns to keep streams alive.
        console.log('[GRAVITY-CHAMP] 🚀 Activator Active (Passive Observer Mode v5.2)');

        setInterval(() => {
            // 🛡️ v5.2 PASSIVE MODE - NO CLICKS, only hover and scroll
            const isPassiveMode = Date.now() < PASSIVE_MODE_UNTIL;

            // 1. Hover simulation ONLY (no clicks) - safe for data scraping
            const triggers = document.querySelectorAll('.odds-item, .market-name, .bet-odds, .league-item, .odds, .item');
            if (triggers.length > 0) {
                const target = triggers[Math.floor(Math.random() * triggers.length)];
                target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            }

            // 2. Simulated Scroll - safe, keeps lazy-loaded content visible
            const scrollers = document.querySelectorAll('.scroll-container, .main-content, body');
            scrollers.forEach(s => {
                s.scrollTop += (Math.random() > 0.5 ? 5 : -5);
            });

            // 3. Token Renewal Guard: DISABLED DURING PASSIVE MODE
            // No automatic clicks or refreshes
            if (!isPassiveMode) {
                const idleTime = Date.now() - (window.lastGravityTraffic || 0);
                if (idleTime > 60000) {
                    console.log('[GRAVITY-CHAMP] 🔄 Session IDLE > 60s. Sending DASHBOARD_PING (no DOM click).');
                    // Avoid modifying DOM during React hydration — send a benign ping instead
                    window.postMessage({ type: 'DASHBOARD_PING', ts: Date.now() }, '*');
                    window.lastGravityTraffic = Date.now();
                }
            } else {
                // Just log if traffic is stale, but don't auto-click
                const idleTime = Date.now() - (window.lastGravityTraffic || 0);
                if (idleTime > 30000 && idleTime % 30000 < 5000) {
                    console.log('[PASSIVE-MODE] 📊 Waiting for manual navigation. No auto-clicks.');
                }
            }

        }, 15000);
    }

    // ============================================================
    // 🛡️ v6.0 STRUCTURAL CLEANUP - activateMarketAuto REMOVED
    // ============================================================
    // IMPORTANT: The activateMarketAuto function has been REMOVED.
    // 
    // REASON: Audit conflict resolution - there was duplicate code between
    // content.js and injected.js causing double-click loops and Live Chat spam.
    //
    // ARCHITECTURE (Single Communication Path):
    //   Backend Command -> content.js (GATEWAY ONLY) -> postMessage -> injected.js (EXECUTOR)
    //
    // content.js is now a PURE GATEWAY:
    //   - Receives commands from chrome.runtime
    //   - Forwards navigation commands to injected.js via postMessage
    //   - NO direct DOM manipulation for navigation
    //
    // injected.js is the SINGLE EXECUTOR:
    //   - Has strict container scoping (AFB88_CONTAINERS, ISPORT_CONTAINERS)
    //   - Has blacklist protection (NAV_BLACKLIST)
    //   - Has cooldown timers (NAV_COOLDOWN)
    //   - Has tab detection pause (NAV_TAB_PAUSE)
    // ============================================================

    // Listen for backend/extension commands via chrome.runtime
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        // Handle teardown instruction from background when account toggled OFF
        if (msg && msg.type === 'TEARDOWN_INJECTION') {
            try {
                window.postMessage({ type: 'GRAVITY_TEARDOWN', accountId: msg.accountId || null }, '*');
            } catch (e) {}
            sendResponse({ ok: true });
            return;
        }

        if (msg.command) {
            console.log(`[GRAVITY] 📩 Command Received: ${msg.command}`);

            // 🛡️ v5.0 NAVIGATION LOCKDOWN: DISABLED duplicate handler
            // Navigation is now EXCLUSIVELY handled by injected.js with strict container scoping
            // This prevents the double-click loop that was causing Live Chat spam
            if (msg.command === 'ACTIVATE_MARKET_AUTO' || msg.command === 'CLICK_FOOTBALL') {
                console.log('%c[CONTENT.JS] ⏸️ Navigation DELEGATED to injected.js (v5.0 Lockdown)', 'background:#ff9800;color:#000;font-weight:bold');
                // DO NOT call activateMarketAuto() here - let injected.js handle it exclusively
                // Just forward to injected.js via postMessage below
            }

            // 🛡️ v4.3: Extension Reload protocol
            if (msg.command === 'RELOAD_EXTENSION') {
                console.warn('[GRAVITY] 🔄 Reloading window by extension command...');
                location.reload();
            }

            // 2. Page Bridge (Forward to injected.js) - Only for navigation commands
            // 🛡️ v5.0: Only forward CLICK_FOOTBALL, block re-forwarding of other commands
            if (msg.command === 'CLICK_FOOTBALL' || msg.command === 'ACTIVATE_MARKET_AUTO') {
                window.postMessage(msg, '*');
            }

            sendResponse({ success: true });
        }
    });

    // ---------- INIT ----------
    function init() {
        injectScript(); // Inject injected.js first
        interceptNetwork();
        if (IS_SHADOW) return;

        setTimeout(createHUD, 800);
        // captureSession removed - now handled by injected.js

        // Start Activator regardless of provider (Passive approach)
        runActivator();

        setInterval(forensicPing, 10000);
        // captureSession removed - network capture is now handled by injected.js

        // 🛡️ v5.0 DISABLED - IFRAME RE-TARGETING was causing duplicate injections
        // Each iframe already gets content.js injected via manifest.json (all_frames: true)
        // Keeping this observer active caused zombie scripts and double-click loops
        // const observer = new MutationObserver((mutations) => {
        //     mutations.forEach((mutation) => {
        //         mutation.addedNodes.forEach((node) => {
        //             if (node.tagName === 'IFRAME') {
        //                 const src = node.getAttribute('src') || '';
        //                 if (src.includes('sports') || node.id.includes('sportsFrame')) {
        //                     console.log('[GRAVITY] 🎯 New sportsFrame detected, initializing hooks...');
        //                     interceptNetwork();
        //                 }
        //             }
        //         });
        //     });
        // });
        // observer.observe(document.documentElement, { childList: true, subtree: true });
        console.log('[GRAVITY] 🛡️ v5.0: Iframe re-targeting DISABLED to prevent zombie scripts');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
