// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');
    const sections = ['sports', 'accounts'];

    // Render fixed Account A/B panels and initialize lights
    renderFixedAccountPanels();

    // Tab Switching Logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.target;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            sections.forEach(s => {
                document.getElementById(`${s}-content`).classList.add('hidden');
            });
            document.getElementById(`${target}-content`).classList.remove('hidden');
        });
    });

    // Load Virtual Accounts
    loadAccounts();
    // Initialize provider lights for saved accounts
    initProviderLights();
    // Load backend URL setting
    chrome.storage.local.get(['backendUrl'], (res) => {
        if (res.backendUrl && document.getElementById('backend-url')) {
            document.getElementById('backend-url').value = res.backendUrl;
        }
    });

    // Add Account Logic
    const addBtn = document.getElementById('add-account');
    addBtn.addEventListener('click', () => {
        const providerType = document.getElementById('acc-provider-type').value;
        const name = document.getElementById('acc-name').value;
        const url = document.getElementById('acc-url') ? document.getElementById('acc-url').value : '';
        const number = document.getElementById('acc-number').value;

        if (!name || !number) {
            alert('Please fill all fields');
            return;
        }

        const account = { id: Date.now(), providerType, name, number, url, active: false };
        saveAccount(account);
    });

    // Save backend URL
    const saveBackendBtn = document.getElementById('save-backend');
    if (saveBackendBtn) {
        saveBackendBtn.addEventListener('click', () => {
            let backendUrl = (document.getElementById('backend-url').value || '').trim();
            if (!backendUrl) {
                alert('Please provide a backend WebSocket URL (ws:// or wss://)');
                return;
            }

            // Normalize common prefixes
            if (backendUrl.startsWith('http://')) backendUrl = backendUrl.replace(/^http:\/\//i, 'ws://');
            if (backendUrl.startsWith('https://')) backendUrl = backendUrl.replace(/^https:\/\//i, 'wss://');
            if (!backendUrl.startsWith('ws://') && !backendUrl.startsWith('wss://')) {
                // Default to secure websocket
                backendUrl = 'wss://' + backendUrl.replace(/^:\/\//, '');
            }

            // Warn if insecure
            if (backendUrl.startsWith('ws://')) {
                if (!confirm('The URL uses unencrypted ws://. Continue?')) return;
            }

            chrome.storage.local.set({ backendUrl }, () => {
                alert('Backend URL saved: ' + backendUrl);
            });
        });
    }

    // Listen for data from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'LIVE_DATA') {
            updateUI(message.data);
        }
        if (message.type === 'PROVIDER_STATUSES_UPDATED') {
            // backend->background notifies UI to refresh lights
            try { initProviderLights(); } catch (e) {}
        }
    });

    // Request initial data update
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_DATA' });
        }
    });

    // Poll for updates if visible
    setInterval(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_DATA' });
            }
        });
    }, 5000);
});

function updateUI(data) {
    if (data.balance) {
        document.getElementById('display-balance').innerText = `Rp ${data.balance}`;
    }

    if (data.matches && data.matches.length > 0) {
        const matchList = document.getElementById('match-list');
        matchList.innerHTML = '';

        data.matches.forEach(match => {
            const item = document.createElement('div');
            item.className = 'match-item';
            item.innerHTML = `
                <div class="match-teams">${match.home} vs ${match.away}</div>
                <div style="font-size: 10px; color: #a0a0a0; margin-bottom: 5px;">${match.league} | ${match.time} | Score: ${match.score}</div>
                <div class="match-odds">
                    <div class="odds-btn">Home: ${match.oddsHome || '-'}</div>
                    <div class="odds-btn">Away: ${match.oddsAway || '-'}</div>
                </div>
            `;
            matchList.appendChild(item);
        });
    }
}

function saveAccount(account) {
    chrome.storage.local.get(['virtualAccounts'], (result) => {
        const accounts = result.virtualAccounts || [];
        accounts.push(account);
        chrome.storage.local.set({ virtualAccounts: accounts }, () => {
            loadAccounts();
            if (document.getElementById('acc-url')) document.getElementById('acc-url').value = '';
            document.getElementById('acc-name').value = '';
            document.getElementById('acc-number').value = '';
            // Do not auto-inject on save; injection occurs when user toggles account ON or uses Inject button
        });
    });
}

function loadAccounts() {
    chrome.storage.local.get(['virtualAccounts'], (result) => {
        const list = document.getElementById('account-list');
        list.innerHTML = '';
        const accounts = result.virtualAccounts || [];

        accounts.forEach(acc => {
            const item = document.createElement('div');
            item.className = 'account-item';
            item.innerHTML = `
                <div>
                    <strong>${acc.providerType}</strong><br>
                    <span>${acc.number} - ${acc.name}</span><br>
                    <small style="color:#a0a0a0">${acc.url || ''}</small>
                    <div class="provider-lights" data-id="lights-${acc.id}"></div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                    <label style="font-size:12px;color:#a0a0a0;display:flex;align-items:center;gap:6px">
                        <input type="checkbox" class="acc-toggle" data-id="${acc.id}" ${acc.active ? 'checked' : ''}> Active
                    </label>
                    <div style="display:flex;gap:8px;align-items:center">
                        <button class="inject-btn" data-id="${acc.id}" style="padding:6px 8px;font-size:12px">Inject</button>
                        <div class="delete-btn" data-id="${acc.id}">✕</div>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                deleteAccount(id);
            });
        });

        // Add toggle listeners
        document.querySelectorAll('.acc-toggle').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                const active = e.target.checked;
                toggleAccount(id, active);
            });
        });

        // Add manual inject listeners
        document.querySelectorAll('.inject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                chrome.storage.local.get(['virtualAccounts'], (res) => {
                    const acc = (res.virtualAccounts || []).find(a => a.id === id);
                    if (acc) {
                        try { chrome.runtime.sendMessage({ type: 'INJECT_ACCOUNT', account: acc }); } catch (e) {}
                    }
                });
            });
        });
    });
}

function deleteAccount(id) {
    chrome.storage.local.get(['virtualAccounts'], (result) => {
        const accounts = result.virtualAccounts || [];
        const filtered = accounts.filter(acc => acc.id !== id);
        chrome.storage.local.set({ virtualAccounts: filtered }, loadAccounts);
    });
}

function toggleAccount(id, active) {
    chrome.storage.local.get(['virtualAccounts'], (result) => {
        const accounts = result.virtualAccounts || [];
        const idx = accounts.findIndex(a => a.id === id);
        if (idx === -1) return;
        accounts[idx].active = !!active;
        // If toggled OFF, clear provider configuration and identifying info for this account to fully reset
        if (!accounts[idx].active) {
            accounts[idx].url = '';
            accounts[idx].name = '';
            accounts[idx].number = '';
            // Clear provider status lights for this account
            chrome.storage.local.get(['providerStatuses'], (res) => {
                const s = res.providerStatuses || {};
                delete s[id];
                chrome.storage.local.set({ providerStatuses: s });
            });
        }

        chrome.storage.local.set({ virtualAccounts: accounts }, () => {
            // Notify background of toggle change; include clearConfig flag when deactivating
            try {
                chrome.runtime.sendMessage({ type: 'ACCOUNT_TOGGLE', account: accounts[idx], active: !!active, clearConfig: !accounts[idx].active });
            } catch (e) {}
            loadAccounts();
        });
    });

// Initialize provider lights for each account after render
function initProviderLights() {
    chrome.storage.local.get(['virtualAccounts','providerStatuses'], (res) => {
        const accounts = res.virtualAccounts || [];
        const statuses = res.providerStatuses || {};
        accounts.forEach(acc => {
            const container = document.querySelector(`.provider-lights[data-id="lights-${acc.id}"]`);
            if (!container) return;
            container.innerHTML = '';
            // create 5 light slots
            for (let i=0;i<5;i++) {
                const light = document.createElement('div');
                light.className = 'light off';
                light.dataset.slot = i;
                // slot0: primary provider
                if (i === 0 && acc.providerType) {
                    light.title = acc.providerType;
                } else if (i === 1 && acc.providerType === 'ISPORT') {
                    light.title = 'SABA';
                } else {
                    light.title = '';
                }
                container.appendChild(light);
            }

            // apply saved statuses if present
            const stat = statuses[acc.id];
            if (stat && typeof stat === 'object') {
                Object.keys(stat).forEach(k => {
                    const slotIdx = stat[k].slotIndex;
                    const state = stat[k].state; // 'on'|'off'|'warn'
                    const slot = container.querySelector(`.light[data-slot="${slotIdx}"]`);
                    if (slot) {
                        slot.classList.remove('off','on','warn');
                        slot.classList.add(state || 'off');
                        if (stat[k].label) slot.title = stat[k].label;
                    }
                });
            } else {
                // default: if account active, mark primary provider green
                if (acc.active && acc.providerType) {
                    const primary = container.querySelector('.light[data-slot="0"]');
                    if (primary) { primary.classList.remove('off'); primary.classList.add('on'); }
                }
            }
        });
    });
}

function renderFixedAccountPanels() {
    // Ensure defaults for panels A and B
    chrome.storage.local.get(['providerStatuses'], (res) => {
        const statuses = res.providerStatuses || {};
        let changed = false;
        if (!statuses['A']) {
            // Account A default primary: AFB88 on slot 0
            statuses['A'] = {
                primary: { slotIndex: 0, state: 'on', label: 'AFB88' }
            };
            changed = true;
        }
        if (!statuses['B']) {
            // Account B default primary: SABA on slot 0
            statuses['B'] = {
                primary: { slotIndex: 0, state: 'on', label: 'SABA' }
            };
            changed = true;
        }
        if (changed) chrome.storage.local.set({ providerStatuses: statuses });

        // Render lights immediately
        ['A','B'].forEach(acc => {
            const container = document.querySelector(`.provider-lights[data-id="lights-${acc}"]`);
            if (!container) return;
            container.innerHTML = '';
            for (let i=0;i<5;i++) {
                const light = document.createElement('div');
                light.className = 'light off';
                light.dataset.slot = i;
                container.appendChild(light);
            }
            const stat = statuses[acc];
            if (stat && stat.primary) {
                const slot = container.querySelector(`.light[data-slot="${stat.primary.slotIndex}"]`);
                if (slot) {
                    slot.classList.remove('off'); slot.classList.add(stat.primary.state || 'on');
                    if (stat.primary.label) slot.title = stat.primary.label;
                }
            }
        });
    });

    // Attach handlers for fixed toggles and inject
    document.querySelectorAll('.fixed-acc-toggle').forEach(el => {
        el.addEventListener('change', (e) => {
            const acc = e.target.dataset.acc;
            const active = e.target.checked;
            try { chrome.runtime.sendMessage({ type: 'ACCOUNT_TOGGLE', account: { id: acc }, active, clearConfig: !active }); } catch (err) {}
        });
    });
    document.querySelectorAll('.fixed-inject-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const acc = e.target.dataset.acc;
            // send inject message for fixed account
            try { chrome.runtime.sendMessage({ type: 'INJECT_ACCOUNT', account: { id: acc } }); } catch (err) {}
        });
    });
}
}
