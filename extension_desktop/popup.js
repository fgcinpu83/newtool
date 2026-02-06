// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');
    const sections = ['sports', 'accounts'];

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

    // Load saved provider
    loadSavedProvider();

    // Initialize provider lamps for fixed panels
    try { initProviderLights(); } catch (e) {}

    // Save Provider Logic
    const saveBtn = document.getElementById('save-provider');
    saveBtn.addEventListener('click', () => {
        const provider = document.getElementById('active-provider').value;
        chrome.storage.local.set({ activeProvider: provider }, () => {
            updateProviderStatus(provider);
            alert('Provider saved successfully!');
        });
    });

    // Listen for data from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'LIVE_DATA') {
            updateUI(message.data);
        }
        if (message.type === 'PROVIDER_STATUSES_UPDATED') {
            // refresh lights when background notifies
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

function loadSavedProvider() {
    chrome.storage.local.get(['activeProvider'], (result) => {
        const provider = result.activeProvider;
        if (provider) {
            document.getElementById('active-provider').value = provider;
            updateProviderStatus(provider);
        } else {
            // No active provider - show default state
            document.getElementById('active-provider').value = 'AFB88'; // Default dropdown value
            updateProviderStatus('Not configured');
        }
    });
}

function initProviderLights() {
    chrome.storage.local.get(['providerStatuses'], (res) => {
        const statuses = res.providerStatuses || {};
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
                    slot.classList.remove('off');
                    slot.classList.add(stat.primary.state || 'on');
                    if (stat.primary.label) slot.title = stat.primary.label;
                }
            }
        });
    });
}

function updateProviderStatus(provider) {
    const statusEl = document.getElementById('provider-status');
    if (provider === 'Not configured') {
        statusEl.textContent = 'Not configured - Select provider above';
        statusEl.style.color = '#ff9800';
    } else {
        statusEl.textContent = `Active: ${provider}`;
        statusEl.style.color = '#4CAF50';
    }
}
