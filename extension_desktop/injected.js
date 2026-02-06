/**
 * GRAVITY NET SNIFFER - INJECTED SCRIPT (v3.1 PASSIVE)
 * ==================================================
 * MODE: PASSIVE SENSOR (Raw Metadata Stream)
 * ARCHITECTURE: Constitution v3.1
 * 
 * 🔒 CONSTITUTIONAL PRINCIPLE:
 * - Extension BUKAN aktor.
 * - Extension tidak memiliki intelligence (No provider detection).
 * - Capture SEMUA traffic mentah beserta metadata.
 */

// 🛡️ v4.7 EARLY EXIT: Do NOT run on non-betting pages
(function () {
    const blockedDomains = ['livechat', 'livechatinc.com', 'tawk.to', 'zendesk',
        'intercom', 'freshdesk', 'crisp', 'olark', 'purechat',
        'helpscout', 'support', 'messenger', 'whatsapp'];
    const host = location.hostname.toLowerCase();
    const url = location.href.toLowerCase();

    if (blockedDomains.some(d => host.includes(d) || url.includes(d))) {
        console.log(`%c[GRAVITY-SNIFFER] 🚫 BLOCKED: ${host}`, 'color:#f00');
        return; // Exit immediately
    }
})();

(function () {
    // 🛡️ v7.1 GLOBAL INJECTION FLAG - Prevent double injection on page refresh
    if (window.__GRAVITY_SNIFFER_INJECTED__) {
        console.log('%c[GRAVITY-SNIFFER] ⚠️ Already injected, skipping duplicate', 'color:#ff0');
        return;
    }
    window.__GRAVITY_SNIFFER_INJECTED__ = true;

    console.log(`%c[GRAVITY-SNIFFER] 📡 PASSIVE SENSOR MODE ACTIVE (v7.1) | Frame: ${window.self !== window.top ? 'IFRAME' : 'TOP'} | URL: ${location.href}`, 'background:#000;color:#0f0;font-size:14px;font-weight:bold');

    // 🛡️ v7.4 CLIENT IDENTITY - Instance-specific ID to prevent blending
    const clientId = `INSTANCE_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    console.log(`%c[GRAVITY-SNIFFER] 🆔 ClientId: ${clientId}`, 'color:#0ff');

    // Environment: configurable local backend hosts/ports (avoid hardcoded literals throughout)
    const BACKEND_HOSTS = ['localhost', '127.0.0.1'];
    const BACKEND_PORTS = ['3001', '3000', '8080'];

    // 🛡️ v8.0 PROVIDER DETECTION - Based on URL patterns only
    function getProviderFromUrl(url) {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('jps9') || lowerUrl.includes('mpo') || lowerUrl.includes('prosportslive') || lowerUrl.includes('afb')) {
            return 'AFB88';
        }
        if (lowerUrl.includes('aro') || lowerUrl.includes('msy') || lowerUrl.includes('saba') || lowerUrl.includes('lcvc') || lowerUrl.includes('qq188')) {
            return 'ISPORT';
        }
        if (lowerUrl.includes('cmd368')) {
            return 'CMD368';
        }
        return null;
    }

    // 🛡️ v8.1 ACTIVE ACCOUNT TRACKING
    let activeAccount = 'A'; // Default to A
    let activeProvider = null; // Will be set from popup or URL detection

    // 🛡️ v8.1 RECEIVE SETTINGS FROM CONTENT SCRIPT
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'GRAVITY_SETTINGS') {
            if (event.data.activeProvider) {
                activeProvider = event.data.activeProvider;
                console.log(`%c[GRAVITY-SNIFFER] 🎯 Active Provider from content: ${activeProvider}`, 'color:#0ff');
            }
            if (event.data.activeAccount) {
                activeAccount = event.data.activeAccount;
                console.log(`%c[GRAVITY-SNIFFER] 🎯 Active Account from content: ${activeAccount}`, 'color:#0ff');
            }
        }
    });

    // Load active provider from URL detection as fallback
    activeProvider = getProviderFromUrl(window.location.href);
    if (activeProvider) {
        console.log(`%c[GRAVITY-SNIFFER] 🎯 Provider from URL: ${activeProvider}`, 'color:#0ff');
    }

    // 🛡️ v6.2 LIFECYCLE SIGNAL: MOUNTED
    window.postMessage({
        __GRAVITY_CONTRACT__: true,
        type: 'LIFECYCLE_SIGNAL',
        stage: 'EXT_MOUNTED',
        clientId: clientId,
        url: window.location.href,
        isIframe: window.self !== window.top,
        capturedAt: Date.now()
    }, '*');

    // 🛡️ v7.1 SESSION KEEPALIVE - 20 seconds for Chrome 116+ Manifest V3 idle timer reset
    const KEEPALIVE_INTERVAL = 20000; // 20 seconds
    let keepaliveTimer = null;

    // 🛡️ v4.1 SHADOW OVERRIDE STATE
    let lastNetworkBTime = Date.now();
    let shadowOverrideActive = false;
    let lastNavClickTime = 0;
    const NAV_COOLDOWN = 15000; // v5.0 Navigation Lockdown: 15 seconds between nav clicks

    // 🛡️ v5.0 NAVIGATION LOCKDOWN - Prevent clicking on chat/support elements
    let navPausedUntil = 0; // Timestamp when nav pause ends
    const NAV_TAB_PAUSE = 30000; // 30 second pause if new tab detected

    // 🛡️ v5.0 ELEMENT BLACKLIST - Words that indicate chat/support elements
    const NAV_BLACKLIST = [
        'chat', 'support', 'help', 'cs', 'bantuan', 'contact', 'livechat',
        'live chat', 'customer', 'service', 'hubungi', 'kontak', 'whatsapp',
        'telegram', 'messenger', 'intercom', 'zendesk', 'tawk', 'crisp'
    ];

    // 🛡️ v5.0 STRICT CONTAINER SELECTORS for sidebar navigation
    const AFB88_CONTAINERS = [
        '#left-menu-container', '#leftMenu', '#left-menu', '.left-menu',
        '#sportsMenu', '.sports-menu', '#MainMenu', '.main-menu',
        '#sidebar', '.sidebar', '#navLeft', '.nav-left'
    ];

    const ISPORT_CONTAINERS = [
        '.menu-wrapper', '#menu-wrapper', '.sports-nav', '#sports-nav',
        '.left-sidebar', '#left-sidebar', '.sport-menu', '#sport-menu',
        '#leftPanel', '.left-panel', '.nav-menu', '#nav-menu'
    ];

    /**
     * 🛡️ v5.0 Check if element is a blacklisted chat/support element
     * @returns {boolean} true if element should be BLOCKED
     */
    function isBlacklistedElement(el) {
        if (!el) return true;

        const id = (el.id || '').toLowerCase();
        const className = (el.className || '').toLowerCase();
        const innerText = (el.innerText || el.textContent || '').toLowerCase().substring(0, 100);
        const href = (el.href || el.getAttribute('href') || '').toLowerCase();

        for (const keyword of NAV_BLACKLIST) {
            if (id.includes(keyword) || className.includes(keyword) ||
                innerText.includes(keyword) || href.includes(keyword)) {
                console.log(`%c[NAV-BLOCK] 🚫 Blocked click attempt on Support/Chat element: "${keyword}" found in element`, 'background:#f00;color:#fff;font-weight:bold');
                return true;
            }
        }

        return false;
    }

    /**
     * 🛡️ v5.0 Find strict container for current site
     * @returns {Element|null} The menu container if found
     */
    function findStrictContainer() {
        const url = window.location.href.toLowerCase();
        const containers = getProviderFromUrl(window.location.href) === 'AFB88' ? AFB88_CONTAINERS : ISPORT_CONTAINERS;

        for (const selector of containers) {
            const container = document.querySelector(selector);
            if (container) {
                console.log(`[NAV-LOCKDOWN] ✅ Using strict container: ${selector}`);
                return container;
            }
        }

        console.log('[NAV-LOCKDOWN] ⚠️ No strict container found. Using fallback.');
        return null;
    }

    /**
     * 🛡️ v5.0 Check if navigation is paused due to tab detection
     */
    function isNavPaused() {
        if (Date.now() < navPausedUntil) {
            const remaining = Math.ceil((navPausedUntil - Date.now()) / 1000);
            console.log(`%c[NAV-PAUSE] ⏸️ Navigation paused for ${remaining}s more due to tab detection`, 'color:#ff9800;font-weight:bold');
            return true;
        }
        return false;
    }

    /**
     * 🛡️ v5.0 Trigger 30 second nav pause (called when new tab detected)
     */
    function triggerNavPause() {
        navPausedUntil = Date.now() + NAV_TAB_PAUSE;
        console.log(`%c[NAV-PAUSE] 🚨 New tab detected! Navigation paused for 30 seconds`, 'background:#f00;color:#fff;font-weight:bold');
    }

    // 🛡️ v7.4 OIPM (Odds Ingestion Per Minute) Metrics
    let oipmCount = 0;
    setInterval(() => {
        if (oipmCount > 0) {
            console.log(`%c[OIPM] 🛡️ Current Ingestion: ${oipmCount} packets/min`, 'background:#2196f3;color:#fff;font-weight:bold');
            oipmCount = 0;
        }
    }, 60000);

    function startKeepalive() {
        if (keepaliveTimer) return; // Already running

        keepaliveTimer = setInterval(() => {
            // Touch the page to keep session alive
            const url = window.location.href;

            // 🔒 ISPORT/SABA keepalive: Touch balance endpoint
            if (getProviderFromUrl(url) === 'ISPORT') {
                fetch('/api/player/balance', { method: 'GET', credentials: 'include' }).catch(() => { });
            }
            // 🔒 AFB88 keepalive: Touch lightweight API
            else if (getProviderFromUrl(url) === 'AFB88') {
                fetch('/api/pgMain', { method: 'GET', credentials: 'include' }).catch(() => { });
            }

            console.log('%c[KEEPALIVE] ♥️ Session heartbeat sent', 'color:#0f0');
        }, KEEPALIVE_INTERVAL);

        console.log('%c[KEEPALIVE] 🔄 Session guardian started (45s interval)', 'color:#ff0;font-weight:bold');
    }

    // Start keepalive after page loads
    if (document.readyState === 'complete') {
        startKeepalive();
    } else {
        window.addEventListener('load', startKeepalive);
    }

    // 🛡️ v5.0 TAB DETECTOR - Monitor for new tabs opening
    let lastWindowCount = 0;
    try {
        lastWindowCount = window.performance ? 1 : 1; // baseline
        window.addEventListener('blur', () => {
            // If window loses focus unexpectedly, might be new tab
            setTimeout(() => {
                if (!document.hasFocus()) {
                    console.log('[NAV-LOCKDOWN] 👁️ Window lost focus - possible new tab');
                    triggerNavPause();
                }
            }, 500);
        });
    } catch (e) { }

    // getProviderHint() removed here to avoid duplicate definitions; using provider detection near DOM scanner

    function sendToExtension(data) {
        console.log(`%c[SEND-TO-EXTENSION] 🚀 Sending data to extension: ${data.url?.substring(0, 60)} | Provider: ${data.provider || 'unknown'} | Account: ${data.account || 'unknown'}`, 'background:#00f;color:#fff;font-weight:bold');

        // 🔍 DEBUG SENSOR: Log data transmission to extension
        console.log(`%c[DEBUG-SENSOR] 📡 PROVIDER→EXTENSION: ${JSON.stringify({
            stage: 'PROVIDER_TO_EXTENSION',
            timestamp: Date.now(),
            url: data.url?.substring(0, 100),
            provider: data.provider,
            account: data.account,
            method: data.method,
            dataSize: JSON.stringify(data).length,
            frameUrl: window.location.href
        }, null, 2)}`, 'background:#4caf50;color:#fff;font-weight:bold');

        // [ANTI-NOISE] Never capture traffic to our own backend or dashboard
        const url = (data.url || '').toLowerCase();
        const isLocalBackendTraffic = BACKEND_HOSTS.some(h => BACKEND_PORTS.some(p => url.includes(`${h}:${p}`)));
        if (isLocalBackendTraffic) {
            console.log(`%c[SEND-SKIP] ⏭️ Skipping backend traffic: ${url.substring(0, 40)}`, 'color:#888');
            return;
        }

        // 🛡️ v7.4 VIRTUAL SOCCER FILTER (Gerbang Pertama)
        // [ENABLED] Filter virtual soccer ACTIVE - Smart filtering v3
        const responseBody = data.responseBody || "";
        const requestBody = data.requestBody || "";
        if (typeof responseBody === 'string' && responseBody.length > 0) {
            // Skip filter for balance endpoints, provider data, or known good URLs
            const isBalanceEndpoint = url.includes('/api/player/balance') || url.includes('balance');
            const isProviderData = getProviderFromUrl(url) !== null || url.includes('ws5');
            const hasBalanceData = /"balance"|"Balance"|"credit"|"Credit"|"uBal"|"ubal"/.test(responseBody);
            const hasEventsData = /"matches"|"events"|"odds"|"home"|"away"|"db"|"js"|"error"/.test(responseBody) &&
                                 (responseBody.includes('"home"') || responseBody.includes('"db"') || responseBody.includes('"js"'));

            if (!isBalanceEndpoint && !isProviderData && !hasBalanceData && !hasEventsData) {
                const virtualSoccerRegex = /(\be-|\s\[V\]|\(V\))/i;
                if (virtualSoccerRegex.test(responseBody) || virtualSoccerRegex.test(url)) {
                    return;
                }
            }
        }

        oipmCount++; // Increment OIPM counter

        const provider = activeProvider || getProviderHint() || getProviderFromUrl(window.location.href);
        if (provider) {
            // 🛡️ v6.2 LIFECYCLE SIGNAL: DOMAIN_DETECTED
            window.postMessage({
                __GRAVITY_CONTRACT__: true,
                type: 'LIFECYCLE_SIGNAL',
                stage: 'DOMAIN_DETECTED',
                provider: provider,
                url: window.location.href,
                capturedAt: Date.now()
            }, '*');
        }

        let method = data.method || 'api_contract_recorder';
        if (provider) method = `${method}_${provider}`;

        // 🛡️ v3.1 LOCKED - Cross-Frame Session Support
        // Include frame URL for ISPORT iframe session_id extraction from /S(sessionid)/ pattern
        const frameUrl = window.location.href;
        const isIframe = window.self !== window.top;

        // v3.1: Stop filtering. Just send metadata.
        window.postMessage({
            __GRAVITY_CONTRACT__: true,
            type: 'api_contract_recorder', // v3.1: Lowercase for backend consistency
            clientId: clientId, // 🛡️ v7.4: Identity Lock
            url: data.url,
            frameUrl: frameUrl,  // 🛡️ Frame URL for session extraction
            title: document.title, // 🛡️ v7.4: Diagnostic hint (e.g. 'Soccer - Saba')
            isIframe: isIframe,  // 🛡️ Flag indicating data from iframe
            method: method,
            provider: provider,
            account: activeAccount, // 🛡️ v8.1: Target account
            requestBody: data.requestBody,
            responseBody: data.responseBody,
            headers: data.headers || {}, // Captured if possible
            status: data.status,
            capturedAt: Date.now()
        }, '*');
    }

    // ============================================================
    // 🛡️ v6.0 SURGICAL NETWORK INJECTION
    // ============================================================
    // SABA/ISPORT JSON endpoints to intercept
    const SABA_INTERCEPT_URLS = [
        '/getmatchlist', '/getmatch', '/geteventlist', '/getevent',
        '/updatematches', '/updatematch', '/getodds', '/odds',
        '/matchlist', '/eventlist', '/leagues', '/getleagues',
        '/markets', '/getmarkets', '/live', '/running',
        '/sports', '/soccer', '/football'
    ];

    // 🔥 v6.1 PRIORITY CAPTURE URLs - Force status override
    const PRIORITY_CAPTURE_URLS = ['/getmatchlist', '/geteventlist', '/matchlist', '/eventlist'];

    // 🔥 v6.1 Account B Status Override Flag
    let accountBFirstCapture = false;
    let accountBEventCount = 0;

    // Check if URL is SABA match data
    function isSabaJsonUrl(url) {
        const lowerUrl = (url || '').toLowerCase();
        return SABA_INTERCEPT_URLS.some(pattern => lowerUrl.includes(pattern));
    }

    // 🔥 v6.1 Check if URL is priority capture (GetMatchList etc)
    function isPriorityCaptureUrl(url) {
        const lowerUrl = (url || '').toLowerCase();
        return PRIORITY_CAPTURE_URLS.some(pattern => lowerUrl.includes(pattern));
    }


    // Extract balance from JSON (v7.1 with flexible path extraction)
    function extractBalance(json) {
        if (!json || typeof json !== 'object') return null;

        // 🛡️ v7.1: Expanded balance keys for Asian whitelabel providers
        const balanceKeys = ['balance', 'Balance', 'credit', 'Credit',
            'availableBalance', 'AvailableBalance', 'cash', 'Cash',
            'bal', 'Bal', 'available', 'Available', 'Amount', 'amount',
            'uBal', 'ubal', 'ba', 'Ba', 'BA', 'Balance2D', 'Balance2',
            'currentBalance', 'CurrentBalance', 'totalBalance', 'TotalBalance',
            'availBal', 'AvailBal', 'memberBal', 'MemberBal'];

        // 🛡️ v7.1: Flexible path extraction - check top level first
        for (const key of balanceKeys) {
            if (json[key] !== undefined && !isNaN(parseFloat(json[key]))) {
                const val = parseFloat(json[key]);
                console.debug(`%c[WS-FLOW] 💰 Balance parsed: Key=${key} Val=${val}`, 'color:#0f0');
                return val;
            }
        }

        // 🛡️ v7.1: Deep search in common wrapper objects
        const wrappers = ['account', 'user', 'db', 'data', 'result', 'response', 'js', 'member', 'info'];
        for (const wrapper of wrappers) {
            if (json[wrapper] && typeof json[wrapper] === 'object') {
                for (const key of balanceKeys) {
                    if (json[wrapper][key] !== undefined && !isNaN(parseFloat(json[wrapper][key]))) {
                        const val = parseFloat(json[wrapper][key]);
                        console.debug(`%c[WS-FLOW] 💰 Balance parsed: Path=${wrapper}.${key} Val=${val}`, 'color:#0f0');
                        return val;
                    }
                }
            }
        }

        // 🛡️ v7.1: Ultra-flexible path: payload?.account?.uBal || payload?.credit
        const flexPaths = [
            json?.account?.uBal, json?.account?.balance, json?.account?.credit,
            json?.user?.balance, json?.user?.credit, json?.user?.uBal,
            json?.db?.Balance, json?.db?.Balance2D, json?.db?.credit,
            json?.member?.balance, json?.member?.credit
        ];
        for (const val of flexPaths) {
            if (val !== undefined && !isNaN(parseFloat(val))) {
                console.debug(`%c[WS-FLOW] 💰 Balance via flex path: ${parseFloat(val)}`, 'color:#0f0');
                return parseFloat(val);
            }
        }

        // Deep search one level (legacy support)
        for (const prop in json) {
            if (json[prop] && typeof json[prop] === 'object') {
                for (const key of balanceKeys) {
                    if (json[prop][key] !== undefined && !isNaN(parseFloat(json[prop][key]))) {
                        return parseFloat(json[prop][key]);
                    }
                }
            }
        }

        return null;
    }

    // Send SABA JSON directly to backend
    // ============================================================
    // 🕵️ v7.8 DEEP SABA PARSER (UNIVERSAL)
    // ============================================================

    /**
     * Recursive search for array of events in unknown JSON structure
     * Kriteria: Array yang elemennya punya MatchId, HomeName, Odds, dsb.
     */
    function findEventsArray(obj, depth = 0) {
        if (depth > 10 || !obj || typeof obj !== 'object') return null;

        // If it's an array, check if it contains SABA-like events
        if (Array.isArray(obj)) {
            if (obj.length > 0) {
                const first = obj[0];
                if (first && typeof first === 'object') {
                    const keys = Object.keys(first).join(',').toLowerCase();
                    const isEvents = keys.includes('matchid') ||
                        keys.includes('homename') ||
                        keys.includes('awayname') ||
                        keys.includes('hteam') ||
                        keys.includes('ateam') ||
                        keys.includes('home_name') ||
                        keys.includes('away_name') ||
                        keys.includes('odds') ||
                        keys.includes('eventid');

                    if (isEvents) return obj;
                }
            }

            // Search inside array elements (max depth for array elements is limited to avoid explosion)
            if (depth < 5) {
                for (let i = 0; i < Math.min(obj.length, 3); i++) {
                    const found = findEventsArray(obj[i], depth + 1);
                    if (found) return found;
                }
            }
        } else {
            // Search inside object properties
            for (const key in obj) {
                const found = findEventsArray(obj[key], depth + 1);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * 🔥 v7.9 STRUCTURE DISCOVERY
     * Logs hierarchy of object level 1 and 2
     */
    function discoverStructure(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;

        const rootKeys = Object.keys(obj);
        console.log(`%c[DISCOVERY] Root Keys: ${JSON.stringify(rootKeys)}`, 'color:#ffa500;font-weight:bold;background:#222');

        rootKeys.forEach(key => {
            const val = obj[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                const level1Keys = Object.keys(val).slice(0, 20);
                console.log(`%c[DISCOVERY] .${key} Keys: ${JSON.stringify(level1Keys)}${Object.keys(val).length > 20 ? '...' : ''}`, 'color:#ffeb3b;background:#222');

                // Deep Discovery Level 2
                level1Keys.forEach(k2 => {
                    const v2 = val[k2];
                    if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
                        const l2k = Object.keys(v2).slice(0, 10);
                        console.log(`%c[DISCOVERY] .${key}.${k2} Keys: ${JSON.stringify(l2k)}`, 'color:#64b5f6;background:#222');
                    }
                });

            } else if (Array.isArray(val)) {
                console.log(`%c[DISCOVERY] .${key} is ARRAY (length: ${val.length})`, 'color:#8bc34a;background:#222');
                if (val.length > 0 && typeof val[0] === 'object') {
                    console.log(`%c[DISCOVERY] .${key}[0] Keys: ${JSON.stringify(Object.keys(val[0]).slice(0, 10))}`, 'color:#8bc34a;background:#222');
                }
            }
        });
    }

    /**
     * 🔥 v7.9 AGGRESSIVE FALLBACK
     * Finds any array with length > 5 if standard events fail
     */
    function findAnyLargeArray(obj, depth = 0) {
        if (depth > 5 || !obj || typeof obj !== 'object') return null;

        if (Array.isArray(obj) && obj.length > 5) return obj;

        if (!Array.isArray(obj)) {
            for (const key in obj) {
                const found = findAnyLargeArray(obj[key], depth + 1);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * 🚀 TAHAP 3.5: Robust Decoder for GZIP/Base64/Socket.io
     * Mission: Prevent SyntaxError/Ghost Match by inflating data before parsing.
     */
    async function safeDecodePayload(rawMsg) {
        if (!rawMsg || typeof rawMsg !== 'string') return rawMsg;
        let body = rawMsg;

        // 1. PEMBERSIHAN SOCKET.IO (v3.5.1 FIX: Use substring to avoid hijacked startsWith Regex)
        if (body.substring(0, 3) === '42[') {
            try {
                const parsed = JSON.parse(body.substring(2));
                body = Array.isArray(parsed) ? parsed[1] : parsed;
            } catch (e) {
                body = body.substring(body.indexOf('['));
            }
        }

        if (typeof body !== 'string') return body;

        // 2. DETEKSI & INFLASI GZIP (H4s signature)
        if (body.substring(0, 5) === 'H4sIA') {
            try {
                const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0));
                const cs = new DecompressionStream('gzip');
                const writer = cs.writable.getWriter();
                writer.write(bytes);
                writer.close();

                const reader = cs.readable.getReader();
                let chunks = [];
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }

                const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                const result = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    result.set(chunk, offset);
                    offset += chunk.length;
                }

                const decoded = new TextDecoder().decode(result);
                console.debug(`%c[INFLATOR] 🎈 Decompressed GZIP payload (${body.length} -> ${decoded.length} chars)`, 'color:#0f0');
                return decoded;
            } catch (err) {
                console.error('[INFLATOR-ERR] Failed to decompress WebSocket frame:', err);
                return body; // Fail-safe: return original
            }
        }

        return body;
    }

    /**
     * Unified handler for SABA JSON with deep parsing and raw fallback
     */
    async function interceptAndParseSaba(url, payload) {
        // 🛡️ Anti-Crash Protection: Validate data type
        if (!payload) return;

        let workingPayload = payload;
        // Ensure we are working with clean string if it was compressed
        if (typeof payload === 'string' && payload.substring(0, 3) === 'H4s') {
            workingPayload = await safeDecodePayload(payload);
        }

        // Validate structure before JSON parse or Regex
        if (typeof workingPayload === 'string') {
            const isGarbage = workingPayload.length > 50 && !workingPayload.includes('{') && !workingPayload.includes('[');
            if (isGarbage) {
                console.log('%c[ANTISYSTEM-GUARD] 🛡️ Ignored suspected binary/garbage', 'color:#f00');
                return;
            }
        }

        // 1. Convert to object if string
        let obj = workingPayload;
        let parseSuccess = false;
        if (typeof workingPayload === 'string' && (workingPayload.substring(0, 1) === '{' || workingPayload.substring(0, 1) === '[')) {
            try { 
                obj = JSON.parse(workingPayload); 
                parseSuccess = true;
            } catch (e) { 
                console.warn(`%c[JSON-PARSE-ERROR] ❌ Malformed JSON from ${url}: ${e.message}`, 'color:#ff0');
                // Continue with raw payload for UNPARSED_FEED
            }
        }

        if (typeof obj !== 'object' || obj === null) {
            // If not object, send as UNPARSED_FEED
            console.log(`%c[PARSER-FALLBACK] ⚠️ Sending raw payload to backend`, 'color:#ff9800');
            sendToExtension({
                url: url,
                method: providerPrefix + 'UNPARSED_FEED',
                status: 200,
                responseBody: typeof payload === 'string' ? payload : JSON.stringify(payload),
                size: (typeof payload === 'string' ? payload : JSON.stringify(payload)).length
            });
            return;
        }

        // 2. 🔥 v7.9.1 AGGRESSIVE DISCOVERY
        const isSabaUrl = getProviderFromUrl(url) === 'ISPORT';

        if (isSabaUrl) {
            console.log(`%c[SABA-RECON] 🛰️ Traffic from: ${url.substring(0, 80)}`, 'background:#311b92;color:#fff;font-weight:bold');
            discoverStructure(obj);
        }

        const size = JSON.stringify(obj).length;

        // 3. DEEP SEARCH for Events
        const events = findEventsArray(obj);

        const isAfbUrl = getProviderFromUrl(url) === 'AFB88';
        const providerPrefix = isAfbUrl ? 'AFB88_' : 'SABA_';

        if (events && events.length > 0) {
            console.log(`%c[PARSER-OK] ✅ Deep Search found ${events.length} events in nested structure`, 'color:#0f0;font-weight:bold');

            sendToExtension({
                url: url,
                method: providerPrefix + 'JSON_DEEP_PARSED',
                status: 200,
                responseBody: JSON.stringify(events),
                fullRaw: JSON.stringify(obj),
                count: events.length,
                size: size
            });
        } else {
            // 4. 🔥 v7.9 AGGRESSIVE FALLBACK: Any Large Array
            const anyArray = findAnyLargeArray(obj);
            if (anyArray) {
                console.log(`%c[PARSER-BYPASS] 🔓 Found Unverified Array (length: ${anyArray.length}). Forwarding...`, 'color:#ff9800;font-weight:bold');
                sendToExtension({
                    url: url,
                    method: providerPrefix + 'UNVERIFIED_STRUCTURE',
                    status: 200,
                    responseBody: JSON.stringify(anyArray),
                    fullRaw: JSON.stringify(obj),
                    size: size
                });
                return;
            }

            // 5. LAST RESORT: Forward RAW as UNPARSED
            console.warn(`%c[PARSER-FALLBACK] ⚠️ Standard events not found. Forwarding raw feed to backend.`, 'color:#ff9800');

            sendToExtension({
                url: url,
                method: providerPrefix + 'UNPARSED_FEED',
                status: 200,
                responseBody: typeof payload === 'string' ? payload : JSON.stringify(payload),
                size: size
            });
        }
    }

    function sendSabaJson(url, jsonData, size) {
        interceptAndParseSaba(url, jsonData);
    }

    // 🛡️ v7.0 SNIFFER STATE (Supports Hot-Reloading)
    let SNIFFER_STATE = {
        sabaKeywords: ['getMatchList', 'getEventList', 'getOdds', 'MatchItems', 'EventItems',
            'LeagueItems', 'HomeName', 'AwayName', 'homeTeam', 'awayTeam',
            'DisplayOdds', 'HDP', 'OddsItems', 'Markets', 'nextmatchid',
            'balance', 'credit', 'ba', 'bl', 'uBal', 'ubal', 'amount', 'Amount',
            'db', 'ServerTime', 'Balance2D', 'Balance2', 'MatchId', 'HomePrice', 'AwayPrice',
            'odds', 'match', 'event', 'listing', 'bet', 'ticket', 'id', 'name'], // 🛡️ v7.7: ULTRA-LOOSE KEYWORDS
        captureLimit: 5000000,
        active: true,
        latencyMin: 0,
        latencyMax: 0
    };

    // Helper for artificial delay (for fetch)
    const applyLatency = async () => {
        if (SNIFFER_STATE.latencyMax > 0) {
            const delay = Math.floor(Math.random() * (SNIFFER_STATE.latencyMax - SNIFFER_STATE.latencyMin)) + SNIFFER_STATE.latencyMin;
            await new Promise(r => setTimeout(r, delay));
        }
    };

    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CONFIG_UPDATE') {
            console.log('%c[v7.0] 🔄 Hot-Reloading Sniffer Config Received!', 'background:#000;color:#0f0;font-weight:bold');
            SNIFFER_STATE = { ...SNIFFER_STATE, ...event.data.config };
        }
    });

    function isSabaMatchData(text, url) {
        if (!SNIFFER_STATE.active || !text || text.length < 5) return false;

        const lowerUrl = url.toLowerCase();
        const isSabaDomain = lowerUrl.includes('aro') || lowerUrl.includes('saba') ||
            lowerUrl.includes('msy') || lowerUrl.includes('b8d6') ||
            lowerUrl.includes('lvx') || lowerUrl.includes('msl') ||
            lowerUrl.includes('afb') || lowerUrl.includes('jps9') ||
            lowerUrl.includes('prosportslive') || lowerUrl.includes('mpo') ||
            lowerUrl.includes('lcvc092n') || lowerUrl.includes('qq188');

        // 🛡️ v7.9.1: if it's a SABA domain and it's JSON/potentially JSON, WE WANT IT.
        if (isSabaDomain && (text.substring(0, 1) === '{' || text.substring(0, 1) === '[')) {
            return true;
        }

        const lowerText = text.toLowerCase();

        // Priority endpoints
        if (lowerUrl.includes('/getmatchlist') || lowerUrl.includes('/geteventlist') ||
            lowerUrl.includes('/balance') || lowerUrl.includes('/credit') ||
            lowerUrl.includes('/pgmain') || lowerUrl.includes('/pgbetodds') ||
            lowerUrl.includes('balance2') || lowerUrl.includes('fnoddsgen')) return true;

        return SNIFFER_STATE.sabaKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
    }

    // 🛡️ v7.0 CONSOLIDATED NETWORK INTERCEPTION
    // 1. XHR HIJACK
    try {
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        const originalXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;
        const xhrData = new WeakMap();

        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            xhrData.set(this, { method, url, headers: {} });
            return originalXHROpen.apply(this, [method, url, ...rest]);
        };

        XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
            const data = xhrData.get(this);
            if (data) data.headers[name] = value;
            return originalXHRSetHeader.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function (body) {
            const data = xhrData.get(this) || { url: '' };
            data.requestBody = body;

            // 🔥 DEBUG: Log ALL XHR requests
            console.log(`%c[DEBUG-XHR] 📡 XHR Intercepted: ${data.url.substring(0, 80)} | Method: ${data.method}`, 'color:#ff0;font-weight:bold');

            this.addEventListener('load', function () {
                try {
                    const url = data.url || '';
                    const responseBody = (this.responseType === '' || this.responseType === 'text') ? this.responseText : (this.responseType === 'json' ? JSON.stringify(this.response) : null);

                    // 🔥 v7.9: LOG ALL XHR for debugging AFB88
                    const isAfbFrame = location.href.includes('jps9') || location.href.includes('afb') || location.href.includes('mpo') || location.href.includes('prosportslive');
                    if (isAfbFrame) {
                        console.log(`%c[XHR-AFB88] 📡 ${url.substring(0, 100)} | Size: ${(responseBody || '').length}`, 'color:#0ff;font-weight:bold');
                    } else {
                        console.log(`%c[XHR-SNIFFER] 📡 Intercepted: ${url.substring(0, 80)} | Size: ${(responseBody || '').length}`, 'color:#888');
                    }

                    if (responseBody && isSabaMatchData(responseBody, url)) {
                        console.log(`%c[DATA-CAPTURE] 🎯 MATCH FOUND! Processing: ${url.substring(0, 60)}`, 'background:#0f0;color:#fff;font-weight:bold');
                        lastNetworkBTime = Date.now();
                        shadowOverrideActive = false;

                        // 🔥 v7.8: Use Universal Parser
                        interceptAndParseSaba(url, responseBody);
                    } else if (responseBody) {
                        console.log(`%c[DATA-SKIP] ⏭️ No match for: ${url.substring(0, 60)} | Size: ${responseBody.length}`, 'color:#666');
                    }
                } catch (e) {
                    console.error('[XHR-ERROR]', e);
                }
            });

            // 🚀 STRESS-TEST: XHR Latency Simulation
            const self = this;
            const args = arguments;
            if (SNIFFER_STATE.latencyMax > 0) {
                const delay = Math.floor(Math.random() * (SNIFFER_STATE.latencyMax - SNIFFER_STATE.latencyMin)) + SNIFFER_STATE.latencyMin;
                setTimeout(() => {
                    originalXHRSend.apply(self, args);
                }, delay);
            } else {
                originalXHRSend.apply(self, args);
            }
        };
        console.log('%c[v7.0] 🔌 XHR Interception ACTIVE', 'color:#0f0;font-weight:bold');
    } catch (e) { console.error('[v7.0] XHR Hijack Error:', e); }

    // 2. FETCH HIJACK
    try {
        const originalFetch = window.fetch;
        window.fetch = async function (resource, config) {
            // 🚀 STRESS-TEST: Fetch Latency Simulation
            await applyLatency();

            const url = (typeof resource === 'string') ? resource : (resource.url || '');

            // 🔥 v7.7: VERBOSE DEBUGGING
            console.log(`%c[FETCH-SNIFFER] 📡 Intercepted: ${url.substring(0, 80)}`, 'color:#888');

            const response = await originalFetch.apply(this, arguments);

            try {
                const clone = response.clone();
                const text = await clone.text();
                console.log(`%c[FETCH-RESPONSE] 📨 Response: ${url.substring(0, 60)} | Size: ${text.length}`, 'color:#0ff');

                if (isSabaMatchData(text, url)) {
                    console.log(`%c[DATA-CAPTURE] 🎯 FETCH MATCH FOUND! Processing: ${url.substring(0, 60)}`, 'background:#0f0;color:#fff;font-weight:bold');
                    // 🔥 v7.8: Use Universal Parser
                    interceptAndParseSaba(url, text);
                } else {
                    console.log(`%c[DATA-SKIP] ⏭️ FETCH No match for: ${url.substring(0, 60)} | Size: ${text.length}`, 'color:#666');
                }
            } catch (e) {
                console.error('[FETCH-ERROR]', e);
            }
            return response;
        };
        console.log('%c[v7.0] 📡 Fetch Interception ACTIVE', 'color:#0f0;font-weight:bold');
    } catch (e) { console.error('[v7.0] Fetch Hijack Error:', e); }
    // ============================================================
    // 🛡️ v6.1 WEBSOCKET INTERCEPTION WITH AFB88 + SABA PRIORITY
    // ============================================================
    try {
        const NativeWebSocket = window.WebSocket;
        if (NativeWebSocket) {
            window.WebSocket = function (...args) {
                const socket = new NativeWebSocket(...args);
                const wsUrl = args[0];
                
                // 🛡️ v9.6: Skip local/backend WebSocket traffic
                const isLocalWs = wsUrl.includes('localhost') || wsUrl.includes('127.0.0.1') || wsUrl.includes(':8080') || wsUrl.includes(':3001');
                if (isLocalWs) {
                    console.log(`%c[WS-CONNECT] 🚫 Skipping local WebSocket: ${wsUrl}`, 'color:#888');
                    return socket;
                }

                console.log(`%c[WS-CONNECT] 🔌 WebSocket opened: ${wsUrl}`, 'color:#0ff;font-weight:bold');

                socket.addEventListener('message', async function (event) {
                    try {
                        const originalPayload = event.data;
                        console.log(`%c[WS-MESSAGE] 📨 Received ${originalPayload.length} bytes from ${wsUrl.substring(0, 50)}`, 'color:#ff0');

                        // Langkah 2: Patch Listener (Injection Point)
                        const cleanData = await safeDecodePayload(originalPayload);
                        console.log(`%c[WS-DECODED] 📦 Decoded ${cleanData.length} chars from ${wsUrl.substring(0, 50)}`, 'color:#0ff');

                        if (isSabaMatchData(cleanData, wsUrl)) {
                            console.log(`%c[DATA-CAPTURE] 🎯 WS MATCH FOUND! Processing: ${wsUrl.substring(0, 50)}`, 'background:#0f0;color:#fff;font-weight:bold');
                            lastNetworkBTime = Date.now();
                            shadowOverrideActive = false;

                            // Langkah 3: Proteksi Regex (Anti-Crash)
                            await interceptAndParseSaba(wsUrl, cleanData);
                        } else {
                            console.log(`%c[DATA-SKIP] ⏭️ WS No match for: ${wsUrl.substring(0, 50)} | Size: ${cleanData.length}`, 'color:#666');

                            // 🛡️ v7.10: FORCE CAPTURE for AFB domains - send everything
                            const isAfbWs = wsUrl.includes('afb') || wsUrl.includes('jps9') || wsUrl.includes('prosportslive');
                            if (isAfbWs && typeof cleanData === 'string' && cleanData.length > 10) {
                                console.log(`%c[WS-AFB-FORCE] 📡 Capturing all data from ${wsUrl.substring(0, 50)}`, 'color:#ff0;font-weight:bold');
                                await interceptAndParseSaba(wsUrl, cleanData);
                            } else if (typeof cleanData === 'string' && cleanData.length > 50) {
                                // console.log(`[WS-CLEAN] Received unexpected data from ${wsUrl}`);
                            }
                        }
                    } catch (e) {
                        console.error('[WS-LISTENER-ERROR]', e);
                    }
                });

                return socket;
            };
            window.WebSocket.prototype = NativeWebSocket.prototype;
            window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING;
            window.WebSocket.OPEN = NativeWebSocket.OPEN;
            window.WebSocket.CLOSING = NativeWebSocket.CLOSING;
            window.WebSocket.CLOSED = NativeWebSocket.CLOSED;

            console.log('%c[v6.1] 🔌 WEBSOCKET HIJACKED for AFB88 + SABA capture', 'color:#0f0;font-weight:bold');
        }
    } catch (e) {
        console.error('[v6.1] WebSocket hijack failed:', e);
    }

    // 🛡️ v6.1: Log injection success
    console.log('%c[v6.1] 🚀 AGGRESSIVE PIPE RECONSTRUCTION ACTIVE', 'background:#000;color:#0f0;font-size:16px;font-weight:bold');
    console.log('%c[v6.1] 📡 AFB88 + SABA WebSocket + XHR + Fetch interception enabled', 'color:#0ff');

    // 🛡️ v3.5.2 ACTIVATE_MARKET_AUTO Listener - DEEP DOM OBSERVER STRATEGY
    // Abandoned nav click strategy - now uses passive DOM parsing
    window.addEventListener('message', (event) => {
        if (event.data && event.data.command === 'ACTIVATE_MARKET_AUTO') {
            console.log('%c[INJECTED] 📩 ACTIVATE_MARKET_AUTO - Starting Deep DOM Observer', 'color:#0f0;font-weight:bold');

            // v3.5.2: Just trigger deep scan instead of clicking
            deepDOMScan();
        }
    });

    // ============================================================
    // 🛡️ v3.5.2 DEEP DOM OBSERVER - Table/Div Parsing for Odds
    // ============================================================

    // Regex patterns for extracting match data
    const ODDS_PATTERN = /^-?\d+\.\d{2}$/;  // Match odds like 1.85, -0.50
    // 🛡️ v4.1 DATA SANITIZATION
    const containsOddsSymbols = (text) => {
        // Regex for odds patterns: digits, slashes, decimal odds, etc.
        return /[\d\/]/.test(text) || text.includes('.') && text.match(/\d+\.\d+/);
    };

    const sanitizeTeamName = (name) => {
        if (!name) return "";
        let clean = name.trim();
        if (containsOddsSymbols(clean)) return null; // Reject if contains odds symbols
        return clean;
    };

    function getProviderHint() {
        const host = location.hostname.toLowerCase();
        const url = location.href.toLowerCase();
        if (host.includes('aro') || host.includes('msy') || host.includes('qq188') || host.includes('saba') || host.includes('mgf')) return 'ISPORT';
        if (host.includes('jps9') || host.includes('mpo') || host.includes('afb') || host.includes('linkcdn') || host.includes('prosportslive')) return 'AFB88';
        return 'UNKNOWN';
    }

    function deepDOMScan() {
        const pHint = getProviderHint();
        if (pHint === 'ISPORT') {
            console.log('[DEEP-DOM] START ISPORT SCRAPE (DOM)...');
        }

        console.log(`%c[DEEP-DOM] 🔍 Starting deep scan of sportsFrame for ${pHint}...`, 'color:#ff0;font-weight:bold');

        const extractedMatches = [];

        // Strategy 1: ISPORT/SABA SPECIFIC (Table or Div-based grid)
        if (pHint === 'ISPORT') {
            const rowSelectors = [
                'tr.oddsRow.mainteam',
                'div.match-item',
                'div.match-row',
                'tr[class*="match"]',
                '.event-item',
                '.match-table tr'
            ];

            rowSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(row => {
                    // Try different name selectors for different skins
                    const hEl = row.querySelector('.HomeNamePC, .team-home, .team-a, [class*="home-team"]');
                    const aEl = row.querySelector('.AwayNamePC, .team-away, .team-b, [class*="away-team"]');

                    if (hEl && aEl) {
                        const home = hEl.textContent.trim();
                        const away = aEl.textContent.trim();
                        if (home && away && home !== away) {
                            // Extract odds if present
                            const oddsElements = Array.from(row.querySelectorAll('.odds, .cclick, .bold, [class*="odds"]'));
                            const oddsValues = oddsElements.map(el => el.textContent.trim()).filter(t => t.match(/^[+\-]?\d+\.\d{2}$/));

                            extractedMatches.push({
                                home, away,
                                homeTeam: home, awayTeam: away,
                                source: 'ISPORT_STRICT_DOM',
                                hp: oddsValues[0] || null,
                                ap: oddsValues[1] || null,
                                oddsVal: oddsValues[0] || null,
                                market: 'HDP'
                            });
                        }
                    }
                });
            });
        }

        // Strategy 2: AFB88 SPECIFIC
        if (extractedMatches.length === 0 && pHint === 'AFB88') {
            document.querySelectorAll('tr.oddsRow.mainteam').forEach(row => {
                const hEl = row.querySelector('.HomeNamePC');
                const aEl = row.querySelector('.AwayNamePC');

                if (hEl && aEl) {
                    const home = hEl.textContent.trim();
                    const away = aEl.textContent.trim();
                    const hpEl = row.querySelector('td.oddsBet[betnum="1"] .cclick');
                    const apEl = row.querySelector('td.oddsBet[betnum="2"] .cclick');

                    if (home && away) {
                        extractedMatches.push({
                            home, away, homeTeam: home, awayTeam: away,
                            source: 'AFB88_STRICT',
                            hp: hpEl ? hpEl.textContent.trim() : null,
                            ap: apEl ? apEl.textContent.trim() : null,
                            oddsVal: hpEl ? hpEl.textContent.trim() : null,
                            market: 'FT_HDP'
                        });
                    }
                }
            });
        }

        // Strategy 3: ROBUST FALLBACK (Team Detection via text analysis)
        if (extractedMatches.length === 0) {
            document.querySelectorAll('table tr, div.row, div[class*="match"]').forEach(container => {
                const teams = extractTeamNamesFromRow(container);
                if (teams.home && teams.away) {
                    extractedMatches.push({
                        home: teams.home, away: teams.away,
                        homeTeam: teams.home, awayTeam: teams.away,
                        source: 'ROBUST_DOM_V2'
                    });
                }
            });
        }

        // Deduplicate and send
        const unique = [];
        extractedMatches.forEach(m => {
            if (!unique.some(u => u.home === m.home && u.away === m.away)) unique.push(m);
        });

        if (unique.length > 0) {
            if (pHint === 'ISPORT') console.log(`[DEEP-DOM] ISPORT DATA PARSED: ${unique.length} items`);
            sendMatchData('DEEP_DOM_SCAN', { matches: unique, count: unique.length, provider: pHint });

            // ⚡ PROACTIVE SIGNAL: Force SCANNING status in UI
            window.postMessage({
                __GRAVITY_CONTRACT__: true,
                type: 'LIFECYCLE_SIGNAL',
                stage: 'SCANNING',
                provider: pHint,
                count: unique.length
            }, '*');
        }
    }



    function extractTeamNamesFromRow(row) {
        // AFB88 Specific first
        const h = row.querySelector('.HomeNamePC');
        const a = row.querySelector('.AwayNamePC');
        if (h && a) {
            return { home: h.textContent.trim(), away: a.textContent.trim() };
        }

        // Generic fallback
        const potentialElements = Array.from(row.querySelectorAll('td, span, div, b, strong'));
        let home = '', away = '';

        for (const el of potentialElements) {
            const text = (el.textContent || "").trim();
            if (!text || text.length < 3 || text.length > 40) continue;
            if (text.match(/[0-9]/)) continue;
            if (['LIVE', 'TODAY', 'SOCCER', 'FOOTBALL'].includes(text.toUpperCase())) continue;

            if (!home) {
                home = sanitizeTeamName(text);
            } else if (!away && text !== home) {
                away = sanitizeTeamName(text);
                break;
            }
        }
        return { home, away };
    }


    function scanAllVisibleText() {
        // Fallback: Scan ALL visible text looking for team-like patterns
        const allText = document.body.innerText || '';
        const lines = allText.split('\n');
        const matches = [];

        const junkLabels = ['live', 'today', 'soccer', 'football', 'basketball', 'tennis', 'bet', 'odds', 'score', 'time', 'half', 'full', 'match', 'event', 'league', 'comp', 'tournament', 'corners', 'total', 'over', 'under', 'hdp', 'ou'];

        for (let i = 0; i < lines.length - 3; i++) {
            const line1 = lines[i].trim();

            // Check current line as potential home team
            if (line1.length < 4 || line1.length > 35 || line1.match(/^\d/) || junkLabels.includes(line1.toLowerCase())) continue;

            // Look ahead up to 3 lines for away team
            for (let j = 1; j <= 3; j++) {
                const lineNext = lines[i + j].trim();
                if (lineNext.length >= 4 && lineNext.length <= 35 &&
                    !lineNext.match(/^\d/) && !lineNext.match(/^[+\-]?\d+\.\d+$/) &&
                    !junkLabels.includes(lineNext.toLowerCase()) &&
                    lineNext.toLowerCase() !== line1.toLowerCase()) {

                    // We found home (line1) and potentially away (lineNext)
                    // If they are separated by "vs" it's even more likely
                    const between = lines.slice(i + 1, i + j).join(' ').toLowerCase();
                    const hasVs = between.includes('vs') || between.includes('-') || between.includes(' @ ');

                    matches.push({
                        home: line1,
                        away: lineNext,
                        source: 'TEXT_SCAN_V2',
                        confidence: hasVs ? 0.9 : 0.6
                    });
                    i += j; // Skip past this match
                    break;
                }
                // If we see something that's definitely NOT a team or separator, stop looking
                if (lineNext.length > 50) break;
            }

            if (matches.length >= 50) break;
        }

        if (matches.length > 0) {
            console.log(`%c[TEXT-SCAN] Found ${matches.length} potential matches`, 'color:#0f0');
            sendMatchData('TEXT_SCAN', { matches: matches.slice(0, 50), count: matches.length });
        }
    }

    // ============================================================
    // 🛡️ v3.5.2 CLICK CAPTURE - When user clicks on odds
    // ============================================================
    document.addEventListener('click', (e) => {
        const target = e.target;
        const text = target.textContent?.trim() || '';

        // Check if clicked element looks like odds (decimal number)
        if (text.match(/^[+\-]?\d+\.\d{2}$/)) {
            console.log(`%c[CLICK-CAPTURE] 🎯 Odds clicked: ${text}`, 'background:#ff0;color:#000;font-weight:bold');

            // Try to find parent row/container with match info
            let parent = target.parentElement;
            for (let i = 0; i < 10 && parent; i++) {
                const parentText = parent.innerText || '';
                const teams = extractTeamNamesFromRow(parent);

                if (teams.home && teams.away) {
                    console.log(`%c[CLICK-CAPTURE] ✅ Match found: ${teams.home} vs ${teams.away}`, 'background:#0f0;color:#000;font-weight:bold');

                    // Send immediately to backend - NO FILTER!
                    window.postMessage({
                        __GRAVITY_CONTRACT__: true,
                        type: 'api_contract_recorder',
                        url: window.location.href,
                        method: 'CLICK_CAPTURE',
                        responseBody: JSON.stringify({
                            source: 'MANUAL_CLICK',
                            home: teams.home,
                            away: teams.away,
                            clickedOdds: text,
                            timestamp: Date.now()
                        }),
                        status: 200
                    }, '*');

                    break;
                }
                parent = parent.parentElement;
            }
        }
    }, true);  // Use capture phase

    // ============================================================
    // 🛡️ v3.5 IFRAME BETTING BRIDGE (aro0061.com support)
    // ============================================================
    const BET_INPUT_SELECTORS = [
        // Primary selectors for aro0061.com SABA betting
        'input[name="stake"]',
        'input[name="Stake"]',
        'input[id*="stake"]',
        'input[id*="Stake"]',
        'input[class*="stake"]',
        'input[class*="bet-amount"]',
        'input[class*="betAmount"]',
        'input[placeholder*="stake"]',
        'input[placeholder*="amount"]',
        // SABA specific
        'input.bet-stake',
        'input.betStake',
        'input#txtStake',
        'input#stake',
        'input#betamount',
        'input[data-type="stake"]',
        'input[data-field="stake"]',
        // Fallback generic number inputs in betting area
        '.bet-slip input[type="text"]',
        '.betslip input[type="text"]',
        '.bet-form input[type="number"]',
        '.stake-input input',
        'input[type="number"][min]'
    ];

    function findBetInputElement() {
        for (const sel of BET_INPUT_SELECTORS) {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) {  // Visible check
                console.log(`[BET-BRIDGE] ✅ Found bet input: ${sel}`);
                return el;
            }
        }
        return null;
    }

    // Listen for BET_INJECT commands from backend
    window.addEventListener('message', (event) => {
        if (event.data && event.data.command === 'BET_INJECT') {
            const { stake, matchId, oddsId } = event.data;
            console.log(`%c[BET-BRIDGE] 📩 Received BET_INJECT: Stake=${stake}`, 'color:#ff0;font-weight:bold');

            const input = findBetInputElement();
            if (input) {
                // Simulate realistic user input
                input.focus();
                input.value = '';

                // Trigger input events for reactive frameworks
                const inputEvent = new Event('input', { bubbles: true });
                const changeEvent = new Event('change', { bubbles: true });

                // Type stake character by character
                const stakeStr = String(stake);
                for (let i = 0; i < stakeStr.length; i++) {
                    input.value += stakeStr[i];
                    input.dispatchEvent(inputEvent);
                }
                input.dispatchEvent(changeEvent);

                console.log(`[BET-BRIDGE] ✅ Stake ${stake} injected successfully`);

                // Report success back
                window.postMessage({
                    __GRAVITY_BET_RESULT__: true,
                    status: 'INJECTED',
                    stake: stake,
                    matchId: matchId
                }, '*');
            } else {
                console.log('[BET-BRIDGE] ❌ No bet input found');
                window.postMessage({
                    __GRAVITY_BET_RESULT__: true,
                    status: 'INPUT_NOT_FOUND',
                    stake: stake
                }, '*');
            }
        }
    });

    // 🛡️ v3.5 MutationObserver for dynamic bet forms
    const url = window.location.href;
    if (url.includes('aro') || url.includes('saba') || url.includes('msy')) {
        let betFormReady = false;
        const observer = new MutationObserver(() => {
            if (!betFormReady) {
                const input = findBetInputElement();
                if (input) {
                    betFormReady = true;
                    console.log('%c[BET-BRIDGE] 🎯 Bet form detected and ready', 'color:#0f0;font-weight:bold');
                    window.postMessage({
                        __GRAVITY_BET_FORM__: true,
                        status: 'READY',
                        url: url
                    }, '*');
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ============================================================
    // 🛡️ v3.5.1 STREAM-DRIVEN DATA CAPTURE
    // ============================================================

    // Keywords to watch for in SABA API responses
    const SABA_KEYWORDS = ['getMatchList', 'getEventList', 'getOdds', 'MatchItems', 'EventItems',
        'LeagueItems', 'HomeName', 'AwayName', 'homeTeam', 'awayTeam',
        'DisplayOdds', 'HDP', 'OddsItems', 'Markets', 'nextmatchid',
        'balance', 'credit', 'ba', 'bl', 'uBal', 'ubal', 'amount', 'Amount'];

    // Enhanced sendToExtension for match data
    function sendMatchData(source, data) {
        const provider = getProviderHint();
        console.log(`%c[STREAM] 🌊 ${source}: Captured match data for ${provider || 'Unknown'}`, 'color:#0f0;font-weight:bold');
        window.postMessage({
            __GRAVITY_CONTRACT__: true,
            type: 'api_contract_recorder',
            url: window.location.href,
            frameUrl: window.location.href,
            isIframe: window.self !== window.top,
            method: provider ? `STREAM_CAPTURE_${provider}` : 'STREAM_CAPTURE',
            provider: provider,
            source: source,
            responseBody: typeof data === 'string' ? data : JSON.stringify(data),
            status: 200,
            capturedAt: Date.now()
        }, '*');
    }

    // ============================================================
    // 🛡️ v3.5.1 AUTO SCANNER - DOM Scraper Every 2 Seconds
    // ============================================================
    function autoScanDOM() {
        const matchElements = [];

        // Common SABA match selectors + ISPORT specific (v5.3)
        const selectors = [
            // Generic selectors
            '.match-item', '.event-item', '.game-item', '.odds-item',
            '[data-match-id]', '[data-event-id]', '[data-matchid]',
            '.league-matches .match', '.market-row', '.bet-row',
            'tr[data-id]', '.game-row', '.match-row',

            // 🛡️ v5.3 SABA/ISPORT-specific selectors
            '.MatchRow', '.EventRow', '.GameRow',
            '[class*="match-row"]', '[class*="event-row"]',
            '.sb-match', '.sb-event', '.sb-game',
            '.schedule-item', '.schedule-row',
            '.league-item .match', '.sport-item .event',
            '.odds-table tr', '.match-odds',
            'div[matchid]', 'div[eventid]',
            '.home-team', '.away-team',
            '.team-a', '.team-b',
            '.HTeam', '.ATeam'
        ];

        // 🛡️ v5.3: Log frame status for debugging
        const isIframe = window.self !== window.top;
        const frameInfo = isIframe ? 'IFRAME' : 'TOP';
        const urlInfo = location.href.substring(0, 60);

        // Check if we're in a SABA frame
        const isSabaFrame = location.href.includes('aro') || location.href.includes('saba') ||
            location.href.includes('msy') || location.href.includes('lvx3306') ||
            location.href.includes('sports') || location.href.includes('b8d6');

        if (isSabaFrame) {
            console.log(`[DOM-SCAN] 🎯 SABA Frame detected: ${frameInfo} - ${urlInfo}`);
        }

        selectors.forEach(sel => {
            try {
                const els = document.querySelectorAll(sel);
                els.forEach(el => matchElements.push(el));
            } catch (e) { }
        });

        // Extract team names from elements
        const extractedMatches = [];

        matchElements.forEach(el => {
            // Try to find home/away text
            const text = el.innerText || el.textContent || '';

            // Look for "vs" pattern
            // v3.5.5 Fix: Add \b and \s to ensure we don't split names like "Rovers"
            const vsMatch = text.match(/([^\n\t]+?)\s+\b(?:vs?\.?|-|@)\b\s+([^\n\t]+)/i);
            if (vsMatch) {
                const home = vsMatch[1].trim().substring(0, 50);
                const away = vsMatch[2].trim().substring(0, 50);
                if (home.length > 2 && away.length > 2 && !extractedMatches.some(m => m.home === home && m.away === away)) {
                    extractedMatches.push({ home, away, source: 'DOM_SCANNER' });
                }
            }

            // Look for data attributes
            const matchId = el.getAttribute('data-match-id') || el.getAttribute('data-matchid') || el.getAttribute('data-id');
            const homeName = el.getAttribute('data-home') || el.querySelector('[data-home]')?.textContent;
            const awayName = el.getAttribute('data-away') || el.querySelector('[data-away]')?.textContent;

            if (homeName && awayName) {
                extractedMatches.push({ home: homeName, away: awayName, matchId, source: 'DOM_ATTR' });
            }
        });

        if (extractedMatches.length > 0) {
            console.log(`%c[AUTO-SCANNER] 🔍 Found ${extractedMatches.length} matches in DOM`, 'color:#ff0;font-weight:bold');
            sendMatchData('DOM_AUTO_SCAN', { matches: extractedMatches, count: extractedMatches.length });
        }
    }

    // ============================================================
    // 🛡️ v3.5.1 LAZY LOAD BYPASS - Force all content visible
    // ============================================================
    function bypassLazyLoad() {
        // Find all lazy-loaded images and force load
        document.querySelectorAll('img[data-src]').forEach(img => {
            if (img.dataset.src && !img.src.includes(img.dataset.src)) {
                img.src = img.dataset.src;
            }
        });

        // Trigger IntersectionObserver entries
        const containers = document.querySelectorAll('.match-list, .event-list, .games-container, .league-container, [class*="scroll"], [class*="virtual"]');
        containers.forEach(container => {
            container.scrollTop = 0;
            // Quick scroll through to trigger lazy loading
            for (let i = 0; i < container.scrollHeight; i += 500) {
                setTimeout(() => { container.scrollTop = i; }, i / 10);
            }
        });

        // Force visibility on hidden elements
        document.querySelectorAll('[style*="visibility: hidden"], [style*="display: none"]').forEach(el => {
            if (el.className && (el.className.includes('match') || el.className.includes('event') || el.className.includes('odds'))) {
                el.style.visibility = 'visible';
                el.style.display = 'block';
            }
        });
    }

    // Duplicate legacy capture helpers removed; consolidated logic exists earlier (v7.0 SNIFFER_STATE and isSabaMatchData)


    // 🛡️ v5.2 PASSIVE OBSERVER MODE - All auto-clicks DISABLED
    // User requested manual navigation only. Data scraping continues.
    // Activated: 2026-01-21T12:21:27+07:00
    // Duration: 10 minutes (until ~12:31:27)
    const PASSIVE_MODE_UNTIL = 1800000000000; // 🛡️ Extended to 2027 to ensure manual control

    // 🛡️ v5.0 NAVIGATION LOCKDOWN: CLICK_FOOTBALL Command with strict scoping
    window.addEventListener('message', (event) => {
        if (event.data && event.data.command === 'CLICK_FOOTBALL') {

            // 🛡️ v5.2 PASSIVE OBSERVER MODE CHECK
            if (Date.now() < PASSIVE_MODE_UNTIL) {
                const remainingMinutes = Math.ceil((PASSIVE_MODE_UNTIL - Date.now()) / 60000);
                console.log(`%c[PASSIVE-MODE] 🔇 Auto-click DISABLED. ${remainingMinutes} minutes remaining. Please navigate manually.`, 'background:#9c27b0;color:#fff;font-weight:bold;font-size:14px');
                console.log('[PASSIVE-MODE] 📊 Data scraping continues in background...');
                return; // EXIT - No clicks allowed
            }
            // v5.0 Check if navigation is paused due to tab detection
            if (isNavPaused()) {
                console.log('[NAV-LOCKDOWN] ⏸️ Navigation paused. Ignoring CLICK_FOOTBALL.');
                return;
            }

            const now = Date.now();
            if (now - lastNavClickTime < NAV_COOLDOWN) {
                const remaining = Math.ceil((NAV_COOLDOWN - (now - lastNavClickTime)) / 1000);
                console.log(`[NAV-LOCKDOWN] ⏳ Navigation cooldown active. Wait ${remaining}s. Skipping...`);
                return;
            }
            lastNavClickTime = now;

            console.log('%c[NAV-LOCKDOWN] ⚽ v5.0 Forcing navigation to Football (STRICT MODE)...', 'background:#4caf50;color:#fff;font-weight:bold');

            // 🛡️ v5.1 STATE MACHINE CHECK - Skip if already on Soccer/Football page
            const url = window.location.href.toLowerCase();
            const alreadyOnFootball =
                url.includes('/soccer') || url.includes('/football') ||
                url.includes('sportid=1') || url.includes('sport=1') ||
                url.includes('sid=1') || url.includes('sepak') ||
                url.includes('/sp/1') || url.includes('/sport/1');

            if (alreadyOnFootball) {
                console.log('%c[NAV-LOCKDOWN] ✅ Already on Football/Soccer page. No navigation needed.', 'color:#4caf50;font-weight:bold');
                return;
            }

            // v5.0 Use strict container only
            const strictContainer = findStrictContainer();
            if (!strictContainer) {
                console.log('[NAV-LOCKDOWN] ❌ NO strict container found. Aborting navigation to prevent spam.');
                return;
            }

            let found = false;
            const isAFB88 = url.includes('jps9') || url.includes('mpo') || url.includes('prosportslive');

            // 🛡️ v5.0 REFINED SELECTOR: AFB88 - Only click <a> with href containing /Soccer/ or /Football/
            if (isAFB88) {
                console.log('[NAV-LOCKDOWN] 🎯 AFB88 Mode: Looking for <a> with href /Soccer/ or /Football/');
                const links = strictContainer.querySelectorAll('a[href*="/Soccer/"], a[href*="/Football/"], a[href*="/soccer/"], a[href*="/football/"]');

                for (const link of links) {
                    if (isBlacklistedElement(link)) continue;

                    console.log(`[NAV-LOCKDOWN] ✅ AFB88 Football link found: ${link.href}`);
                    link.click();
                    found = true;
                    break;
                }

                if (!found) {
                    // Fallback: Look for specific IDs/classes
                    const fallbackSelectors = ['#sport_1', '.icon-football', '.icon-soccer', 'a[data-sport="1"]', 'a[data-sport="soccer"]'];
                    for (const sel of fallbackSelectors) {
                        const el = strictContainer.querySelector(sel);
                        if (el && !isBlacklistedElement(el)) {
                            console.log(`[NAV-LOCKDOWN] ✅ AFB88 Fallback found: ${sel}`);
                            el.click();
                            found = true;
                            break;
                        }
                    }
                }
            } else {
                // ISPORT/Non-AFB88: Use text-based search within strict container
                console.log('[NAV-LOCKDOWN] 🎯 ISPORT Mode: Text-based search in strict container');

                const findByTextStrict = (searchText) => {
                    // v5.0 Only search within strict container, only <a> and <li> elements
                    const elements = strictContainer.querySelectorAll('a, li');
                    for (const el of elements) {
                        // v5.0 BLACKLIST CHECK - Skip chat/support elements
                        if (isBlacklistedElement(el)) continue;

                        const text = (el.textContent || '').trim().toLowerCase();
                        const isMatch = text === searchText.toLowerCase() ||
                            (text.includes(searchText.toLowerCase()) && text.length < 25);

                        if (isMatch) {
                            // Additional verification: element should look like a menu item
                            const tagName = el.tagName.toLowerCase();
                            const hasClickableParent = el.closest('nav, ul, menu, .menu, .nav');

                            if (tagName === 'a' || hasClickableParent) {
                                return el;
                            }
                        }
                    }
                    return null;
                };

                const footballBtn = findByTextStrict('Football') || findByTextStrict('Soccer') ||
                    findByTextStrict('Sepak Bola') || findByTextStrict('足球');

                if (footballBtn) {
                    console.log('[NAV-LOCKDOWN] ✅ Football/Soccer button found in strict container, clicking...');
                    footballBtn.click();
                    found = true;
                }
            }

            if (!found) {
                console.log('%c[NAV-LOCKDOWN] ⚠️ Could not find Football trigger in strict container. NOT falling back to prevent spam.', 'color:#ff9800;font-weight:bold');
            } else {
                console.log('%c[NAV-LOCKDOWN] ✅ Navigation successful. Next allowed in 15 seconds.', 'color:#4caf50;font-weight:bold');
            }
        }
    });

    // ============================================================
    // 🛡️ v4.0 START STREAM-DRIVEN CAPTURE (XHR-ONLY)
    // ============================================================
    const currentUrl = window.location.href.toLowerCase();
    if (currentUrl.includes('aro') || currentUrl.includes('saba') || currentUrl.includes('msy') ||
        currentUrl.includes('mgf') || currentUrl.includes('qq188') || currentUrl.includes('b8d6')) {

        console.log('%c[STREAM] 🚀 Stream-Driven Capture v4.5 ACTIVE', 'background:#000;color:#0f0;font-size:14px;font-weight:bold');
        console.log('%c[STREAM] DOM Scanning ACTIVE as FALLBACK', 'color:#ff0;font-weight:bold');

        // v4.5: Re-enable DOM Scanners as fallback if network is silent for 15s
        setInterval(() => {
            const timeSinceLastNetwork = (Date.now() - lastNetworkBTime) / 1000;
            if (timeSinceLastNetwork > 15) {
                if (!shadowOverrideActive) {
                    console.log('%c[FALLBACK] ⚠️ No network data for 15s. Running DOM Scanners...', 'color:#ff9800;font-weight:bold');
                    shadowOverrideActive = true;
                }
                deepDOMScan();
                autoScanDOM();
            } else {
                if (shadowOverrideActive) {
                    console.log('%c[FALLBACK] ✅ Network data resumed.', 'color:#4caf50;font-weight:bold');
                    shadowOverrideActive = false;
                }
            }
        }, 3000);

        // Run lazy load bypass every 5 seconds
        setInterval(bypassLazyLoad, 5000);

        setTimeout(() => {
            bypassLazyLoad();
        }, 1000);

        // 🛡️ v4.1 SHADOW OVERRIDE TIMER (AFB88 Specific)
        if (currentUrl.includes('jps9') || currentUrl.includes('mpo') || currentUrl.includes('prosportslive')) {
            setInterval(() => {
                const timeSinceLastNetwork = (Date.now() - lastNetworkBTime) / 1000;
                if (timeSinceLastNetwork > 5 && !shadowOverrideActive) {
                    console.log('%c[SHADOW-OVERRIDE] 🚨 Network capture stale (>5s). Activating DOM Scraper for AFB88!', 'background:#f00;color:#fff;font-weight:bold');
                    shadowOverrideActive = true;
                }

                if (shadowOverrideActive) {
                    deepDOMScan();
                }

                // 🛡️ v6.1 AFB88 SIMULATED INTERACTION
                // Occasionally scroll or hover to keep server pushing odds
                if (Math.random() > 0.7) {
                    const oddsElements = document.querySelectorAll('.odds, .odds-value, .HomePrice, .AwayPrice');
                    if (oddsElements.length > 0) {
                        const randomEl = oddsElements[Math.floor(Math.random() * oddsElements.length)];
                        // Simulated hover
                        randomEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                        setTimeout(() => randomEl.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })), 500);
                    }
                }
            }, 2000);
        }
    }

})();
