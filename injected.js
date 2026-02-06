// injected.js - MPO1221 & AFB88 Helper

if (window.__GRAVITY_INJECTED__) {
    console.log('injected.js: already injected - skipping duplicate load');
} else {
    window.__GRAVITY_INJECTED__ = true;
    console.log("MPO1221 Helper Injected - Frame: " + window.location.href);

    // Keep references to originals for teardown
    const __gravity_orig = {
        XHR_open: XMLHttpRequest.prototype.open,
        XHR_send: XMLHttpRequest.prototype.send,
        fetch: window.fetch
    };

// HUD Logic
function createHUD() {
    if (document.getElementById('mpo-helper-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'mpo-helper-hud';
    hud.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(15, 17, 21, 0.9);
        color: #c1a05c;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid #c1a05c;
        z-index: 999999;
        font-family: sans-serif;
        font-size: 12px;
        pointer-events: none;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
    `;
    hud.innerHTML = `<strong>MPO Helper</strong><br><span id="hud-status">Scanning...</span>`;
    document.body.appendChild(hud);
}

// Scraper Logic
function scrapeAFB88() {
    const matches = [];
    const leagueRows = document.querySelectorAll('tr.oddsLeague');

    leagueRows.forEach(leagueRow => {
        const leagueName = leagueRow.querySelector('.lname')?.innerText || 'Unknown League';
        let nextRow = leagueRow.nextElementSibling;

        while (nextRow && nextRow.classList.contains('oddsRow')) {
            if (nextRow.classList.contains('mainteam')) {
                const home = nextRow.querySelector('.HomeNamePC')?.innerText;
                const away = nextRow.querySelector('.AwayNamePC')?.innerText;
                const score = nextRow.querySelector('.oddsRow-live-score')?.innerText;
                const time = nextRow.querySelector('.Heading5New')?.innerText;

                // Odds (betnum 1 & 2 are usually HDP Home/Away)
                const oddsHome = nextRow.querySelector('.oddsBet[betnum="1"] .cclick')?.innerText;
                const oddsAway = nextRow.querySelector('.oddsBet[betnum="2"] .cclick')?.innerText;

                if (home && away) {
                    matches.push({
                        league: leagueName,
                        home, away, score, time, oddsHome, oddsAway
                    });
                }
            }
            nextRow = nextRow.nextElementSibling;
            if (nextRow && nextRow.classList.contains('oddsLeague')) break;
        }
    });

    return matches;
}

function scrapeBalance() {
    // Try to find balance in MPO main site or AFB header
    const balEl = document.getElementById('display_balance') || document.getElementById('txtBalance');
    return balEl ? balEl.innerText : null;
}

function getFullData() {
    const data = {
        url: window.location.href,
        balance: scrapeBalance(),
        matches: scrapeAFB88()
    };
    return data;
}

// Communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_DATA') {
        const data = getFullData();
        chrome.runtime.sendMessage({ type: 'LIVE_DATA', data: data });
    }
});

// Network interception: capture XHR and fetch responses and forward to extension via postMessage
let __gravity_interval = null;
let __gravity_teardown_called = false;

(function() {
    try {
        // XHR
        const _open = XMLHttpRequest.prototype.open;
        const _send = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            this.__gravity_url = url;
            return _open.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(body) {
            const xhr = this;
            const start = Date.now();
            const onLoad = function() {
                try {
                    const resp = xhr.responseText;
                    const data = {
                        __GRAVITY_CONTRACT__: true,
                        type: 'XHR_CAPTURE',
                        url: xhr.__gravity_url || location.href,
                        method: xhr.method || 'GET',
                        status: xhr.status,
                        responseBody: resp,
                        timestamp: Date.now(),
                        duration: Date.now() - start
                    };
                    window.postMessage(data, '*');
                } catch (e) {}
            };
            try {
                this.addEventListener('load', onLoad);
            } catch (e) {}
            return _send.apply(this, arguments);
        };
    } catch (e) {}

    // Fetch
    try {
        const _fetch = window.fetch;
        window.fetch = function(input, init) {
            const start = Date.now();
            return _fetch.apply(this, arguments).then(async (resp) => {
                try {
                    const clone = resp.clone();
                    let text = null;
                    try { text = await clone.text(); } catch (e) { text = null; }
                    const data = {
                        __GRAVITY_CONTRACT__: true,
                        type: 'FETCH_CAPTURE',
                        url: (typeof input === 'string') ? input : (input && input.url) || location.href,
                        status: resp.status,
                        responseBody: text,
                        timestamp: Date.now(),
                        duration: Date.now() - start
                    };
                    window.postMessage(data, '*');
                } catch (e) {}
                return resp;
            });
        };
    } catch (e) {}
})();

// Periodic scraping for HUD
__gravity_interval = setInterval(() => {
    const data = getFullData();
    const hudStatus = document.getElementById('hud-status');
    if (hudStatus) {
        if (data.matches.length > 0) {
            hudStatus.innerText = `${data.matches.length} matches found | Bal: ${data.balance || '?'}`;
        } else {
            hudStatus.innerText = "No live matches found in this frame.";
        }
    }
}, 3000);

if (window.top === window) {
    createHUD();
}

// Teardown handler - listens for GRAVITY_TEARDOWN posted from content script
function __gravity_teardown(e) {
    try {
        const d = e && e.data;
        if (!d || d.type !== 'GRAVITY_TEARDOWN') return;
    } catch (err) { return; }
    if (__gravity_teardown_called) return;
    __gravity_teardown_called = true;

    try {
        // Restore originals
        if (__gravity_orig && __gravity_orig.XHR_open) XMLHttpRequest.prototype.open = __gravity_orig.XHR_open;
        if (__gravity_orig && __gravity_orig.XHR_send) XMLHttpRequest.prototype.send = __gravity_orig.XHR_send;
        if (__gravity_orig && __gravity_orig.fetch) window.fetch = __gravity_orig.fetch;
    } catch (e) { console.warn('injected.js teardown: restore failed', e); }

    try {
        // Remove HUD
        const hud = document.getElementById('mpo-helper-hud');
        if (hud && hud.parentNode) hud.parentNode.removeChild(hud);
    } catch (e) {}

    try { if (__gravity_interval) clearInterval(__gravity_interval); } catch (e) {}

    try { window.__GRAVITY_INJECTED__ = false; } catch (e) {}
    try { window.removeEventListener('message', __gravity_teardown); } catch (e) {}

    try {
        // Notify extension that teardown completed
        window.postMessage({ __GRAVITY_CONTRACT__: true, type: 'TEARDOWN_COMPLETE', timestamp: Date.now() }, '*');
    } catch (e) {}
}

window.addEventListener('message', __gravity_teardown);
