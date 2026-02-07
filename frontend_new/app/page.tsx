'use client';

import React, { useEffect, useState, useReducer, useCallback, useRef } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { useSystemStatus } from './lib/SystemStatusContext';

// ===============================================
// TYPES
// ===============================================
interface SystemStatus {
    accountA_active: boolean;
    accountB_active: boolean;
    balanceA: string;
    balanceB: string;
    profit_session: string;
    profit_today: string;
    providers?: {
        A?: { status: string };
        B?: { status: string };
    };
}

interface LiveFeedItem {
    id: string;
    timestamp: number;
    account: string;           // "A"
    bookmaker: string;         // "SBO"
    home: string;
    away: string;
    market: string;
    selection: string;
    line: string;
    odds: string;
    decOdds?: number;

    accountB: string;          // "B"
    bookmakerB: string;        // "CMD"
    selectionB: string;
    marketB: string;
    lineB: string;
    oddsB: string;
    decOddsB?: number;

    profit: string | null;
    state?: 'VERIFIED' | 'POTENTIAL';
}

interface TradeExecution {
    id: string; timestamp: number; providerA: string; providerB: string;
    teamA: string; teamB: string; type: string; oddsA: string; oddsB: string; profit: string; status: string; amount: string;
}

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const BACKEND_HTTP = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const SOCKET_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;

// ===============================================
// HELPER: FUZZY & MATCHING
// ===============================================
const cleanName = (name: string) => name ? name.replace(/\(.*\)/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim() : '';
const normalizeTeam = (name: string) => name.toLowerCase().replace(/\b(fc|sc|ac|cd|united|utd|uni|city|town|club)\b/g, '').replace(/[^\w\s]/g, '').trim();
const getScore = (n1: string, n2: string) => {
    const set1 = new Set(normalizeTeam(n1).split(' ').filter(w => w.length > 2));
    const set2 = new Set(normalizeTeam(n2).split(' ').filter(w => w.length > 2));
    if (!set1.size || !set2.size) return 0;
    const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
    return intersection.size / new Set([...Array.from(set1), ...Array.from(set2)]).size;
};
const isCriticalMismatch = (n1: string, n2: string) => {
    const s1 = n1.toLowerCase(), s2 = n2.toLowerCase();
    if ((s1.includes('city') && s2.includes('united')) || (s1.includes('united') && s2.includes('city'))) return true;
    if (s1.includes('women') !== s2.includes('women')) return true;
    return false;
};

// 🛡️ v7.1 SCANNER ERROR STATES
type ScannerErrorType = 'ACCOUNT_A_OFFLINE' | 'ACCOUNT_B_OFFLINE' | 'INSUFFICIENT_LIQUIDITY' |
    'NO_PAIRS_FOUND' | 'CONNECTION_LOST' | 'BALANCE_ZERO' | null;

interface ScannerError {
    type: ScannerErrorType;
    message: string;
    timestamp: number;
}

// 🛡️ v7.1 LIVE FEED REDUCER - Batching high-frequency updates
type LiveFeedAction =
    | { type: 'ADD_ITEMS'; items: LiveFeedItem[] }
    | { type: 'REPLACE_ALL'; items: LiveFeedItem[] }
    | { type: 'CLEAR' };

function liveFeedReducer(state: LiveFeedItem[], action: LiveFeedAction): LiveFeedItem[] {
    switch (action.type) {
        case 'ADD_ITEMS':
            // Deduplicate by id and keep max 200 items
            const existingIds = new Set(state.map(i => i.id));
            const newItems = action.items.filter(i => !existingIds.has(i.id));
            return [...newItems, ...state].slice(0, 200);
        case 'REPLACE_ALL':
            return action.items.slice(0, 200);
        case 'CLEAR':
            return [];
        default:
            return state;
    }
}


// ===============================================
// COMPONENT
// ===============================================
export default function Page() {
    const { connected, ready, emit, setOnMessage } = useSystemStatus();
    // const [connected, setConnected] = useState(false); // Moved to context

    // Toggle Debounce Lock
    const toggleLock = React.useRef<{ [key: string]: boolean }>({});

    // 🛡️ v7.4: Throttled Batch Update Pipeline Refs
    const updateBuffer = useRef<LiveFeedItem[]>([]);
    const lastBatchTime = useRef<number>(0);
    // 🛡️ v11.0: Default state is OFF for both accounts
    const [systemStatus, setSystemStatus] = useState<SystemStatus>({
        accountA_active: false, accountB_active: false,
        balanceA: '0.00', balanceB: '0.00', profit_session: '0.00', profit_today: '0.00',
        providers: {}
    });

    // Provider statuses (per-account) - maps like { A: { primary: { slotIndex, state, label } }, B: { ... } }
    const [providerStatuses, setProviderStatuses] = useState<{ [k: string]: any }>({ A: {}, B: {} });
    // Pipeline Health State
    const [pipelineHealth, setPipelineHealth] = useState({
        status: 'RED',
        reason: 'WAITING_FOR_BACKEND',
        layers: {}
    });

    // Guardian Status State
    const [guardianStatus, setGuardianStatus] = useState<any>({});

    // 🛡️ v8.0: Clean state - no dummy data
    const [liveFeed, dispatchLiveFeed] = useReducer(liveFeedReducer, []);
    const [showPairsOnly, setShowPairsOnly] = useState(true);
    const [executionHistory, setExecutionHistory] = useState<TradeExecution[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [pingA, setPingA] = useState<number | null>(null);
    const [pingB, setPingB] = useState<number | null>(null);
    const [activeEventsA, setActiveEventsA] = useState(0);
    const [activeEventsB, setActiveEventsB] = useState(0);
    const [oipm, setOipm] = useState({ A: 0, B: 0 });

    // 🛡️ v8.0 DRAWDOWN STATE - Per Provider P/L Tracking
    const [drawdown, setDrawdown] = useState({
        A: { profit: 0, loss: 0, netPL: 0, winRate: 0, trades: 0, streak: 0 },
        B: { profit: 0, loss: 0, netPL: 0, winRate: 0, trades: 0, streak: 0 }
    });

    // 🛡️ v8.0 Chrome Status
    const [chromeStatus, setChromeStatus] = useState<{
        connected: boolean;
        tabs: number;
        error?: string;
    }>({ connected: false, tabs: 0 });

    // 🛡️ v7.1 SCANNER ERROR STATE - Explicit error messages
    const [scannerError, setScannerError] = useState<ScannerError | null>(null);

    // Full Config State to match UI
    const [config, setConfig] = useState({
        matchType: 'Both',
        minProfit: 1.5,
        maxProfit: 15.0,
        roundOff: 0.50,
        marketTypes: { ftHdp: true, htHdp: true, ftOu: false, htOu: false },
        tiers: {
            t1: { active: true, amount: 500 },
            t2: { active: true, amount: 250 },
            t3: { active: false, amount: 50 }
        },
        urlA: '',  // Default empty as requested
        urlB: '',   // Default empty as requested
        providerA: 'SABA',  // Provider dropdown for Account A
        providerB: 'AFB88'  // Provider dropdown for Account B
    });

    // Silent Mode State
    const [silentMode, setSilentMode] = useState(false);

    // 🛡️ v7.0 Stress Test State
    const [stressMetrics, setStressMetrics] = useState({
        heap: 0, packets: 0, malformed: 0, wsDrops: 0, active: false
    });

    // 🛡️ v4.0 AUTO-DISCOVERY STATE
    const [unknownTraffic, setUnknownTraffic] = useState<any[]>([]);

    const addLog = useCallback((msg: string) => {
        setLogs(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p.slice(0, 50)]);
    }, []);

    const playSound = (type: 'success' | 'alert') => {
        if (silentMode) return;
    };


    // Message handler for socket messages
    const handleSocketMessage = useCallback((data: any) => {
        try {
            if (data.event === 'health:pipeline') {
                setPipelineHealth(data.data);
            } else if (data.event === 'provider_status') {
                try {
                    const acc = String(data.data.account);
                    const provider = data.data.provider || 'UNKNOWN';
                    const status = (data.data.status || '').toString().toLowerCase();
                    let lampState: 'on'|'warn'|'off' = 'off';
                    if (status === 'online' || status === 'ok' || status === 'active') lampState = 'on';
                    else if (status === 'warn' || status === 'degraded' || status === 'slow') lampState = 'warn';
                    else lampState = 'off';

                    setProviderStatuses(prev => ({
                        ...prev,
                        [acc]: {
                            ...(prev[acc] || {}),
                            primary: { slotIndex: 0, state: lampState, label: provider }
                        }
                    }));
                } catch (err) { console.warn('provider_status parse error', err); }
            } else if (data.event === 'system_status') {
                setSystemStatus({
                    accountA_active: data.data.accountA_active,
                    accountB_active: data.data.accountB_active,
                    balanceA: data.data.balanceA,
                    balanceB: data.data.balanceB,
                    profit_session: data.data.profit_session || '0.00',
                    profit_today: data.data.profit_today || '0.00',
                    providers: data.data.providers // Ensure providers are also updated
                });
                if (data.data.activeEventsA !== undefined) setActiveEventsA(data.data.activeEventsA);
                if (data.data.activeEventsB !== undefined) setActiveEventsB(data.data.activeEventsB);

                // Pipeline Health Logic
                if (data.data.providers) {
                    const a1Live = data.data.providers.A1?.state === 'LIVE';
                    const b1Live = data.data.providers.B1?.state === 'LIVE';
                    let newStatus = 'RED', reason = 'WAITING_FOR_DATA';
                    if (a1Live && b1Live) { newStatus = 'GREEN'; reason = 'BOTH_PROVIDERS_LIVE'; setScannerError(null); }
                    else if (a1Live || b1Live) {
                        newStatus = 'YELLOW';
                        reason = a1Live ? 'WAITING_FOR_B' : 'WAITING_FOR_A';
                        setScannerError({
                            type: a1Live ? 'ACCOUNT_B_OFFLINE' : 'ACCOUNT_A_OFFLINE',
                            message: a1Live ? 'Account B is offline.' : 'Account A is offline.',
                            timestamp: Date.now()
                        });
                    }
                    setPipelineHealth(prev => ({ ...prev, status: newStatus, reason: reason }));
                }
            } else if (data.event === 'live_feed') {
                dispatchLiveFeed({ type: 'ADD_ITEMS', items: [data.data] });
            } else if (data.event === 'active_events') {
                if (data.data.A !== undefined) setActiveEventsA(data.data.A);
                if (data.data.B !== undefined) setActiveEventsB(data.data.B);
            } else if (data.event === 'execution_history') {
                setExecutionHistory(data.data);
                playSound('success');
            } else if (data.event === 'metrics:oipm') {
                setOipm(data.data);
            } else if (data.event === 'status:guardian' || data.event === 'guardian:status') {
                setGuardianStatus(data.data);
            } else if (data.event === 'chrome:status') {
                setChromeStatus(data.data);
                if (!data.data.connected) {
                    addLog('⚠️ Chrome not detected on port 9222. Run LAUNCH_CHROME.bat first!');
                }
            } else if (data.event === 'browser:opened') {
                addLog(`✅ Browser ${data.data.action}: ${data.data.url} (Account ${data.data.account})`);
            } else if (data.event === 'browser:focused') {
                addLog(`🎯 Focused tab: ${data.data.tabTitle} (Account ${data.data.account})`);
            } else if (data.event === 'browser:error') {
                addLog(`❌ Browser error (Account ${data.data.account}): ${data.data.error}`);
            } else if (data.event === 'scanner:update_batch') {
                setScannerError(null);

                // 🕵️ TRACE_AUDIT INJECTION
                if (data.data && data.data.length > 0) {
                    console.log('[TRACE_AUDIT][LEVEL:FRONTEND] Socket Received (Batch):', {
                        first_match_id: data.data[0].eventId,
                        batch_size: data.data.length,
                        latency: Date.now() - (data.data[0].lastUpdate || Date.now())
                    });
                }

                const newItems = data.data.map((pair: any) => ({
                    id: pair.pairId, timestamp: pair.lastUpdate,
                    account: pair.legA?.provider || '-', bookmaker: pair.legA?.bookmaker || '-',
                    home: pair.legA?.home || pair.legB?.home || '-', away: pair.legA?.away || pair.legB?.away || '-',
                    market: pair.market, selection: pair.legA?.odds.selection || '-',
                    line: pair.legA?.odds.line || '-', odds: String(pair.legA?.odds.val || '-'),
                    decOdds: pair.legA?.odds.val || 0,
                    accountB: pair.legB?.provider || '-', bookmakerB: pair.legB?.bookmaker || '-',
                    selectionB: pair.legB?.odds.selection || '-', marketB: pair.market,
                    lineB: pair.legB?.odds.line || '-', oddsB: String(pair.legB?.odds.val || '-'),
                    decOddsB: pair.legB?.odds.val || 0, profit: pair.profit, state: pair.state
                }));
                updateBuffer.current = [...newItems, ...updateBuffer.current].slice(0, 200);
            } else if (data.event === 'system_log') {
                const prefix = data.data.level === 'error' ? '❌' : data.data.level === 'warn' ? '⚠️' : '✅';
                addLog(`${prefix} ${data.data.message}`);
            } else if (data.event === 'stress_metrics') {
                if (data.data.type === 'HEAP') setStressMetrics(prev => ({ ...prev, heap: data.data.value }));
            } else if (data.event === 'stress_anomaly') {
                if (data.data.type === 'WS_DROP') setStressMetrics(prev => ({ ...prev, wsDrops: prev.wsDrops + 1 }));
            } else if (data.event === 'UNKNOWN_PROVIDER_DATA') {
                setUnknownTraffic(prev => {
                    // Deduplicate by URL
                    if (prev.some(t => t.url === data.data.url)) return prev;
                    return [data.data, ...prev].slice(0, 5); // Keep last 5
                });
            }
        } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
        }
    }, [addLog, playSound]);

    // Set message handler
    useEffect(() => {
        setOnMessage(handleSocketMessage);
        return () => setOnMessage(null);
    }, [setOnMessage, handleSocketMessage]);

    // Emit GET_STATUS when connected
    useEffect(() => {
        if (connected) {
            emit('type', 'GET_STATUS');
            addLog('✅ Bridge Connected.');
            console.log('[SOCKET] ✅ Bridge Active');
        }
    }, [connected, emit, addLog]);

    // Check Chrome status on load
    useEffect(() => {
        const timer = setTimeout(() => {
            emit('type', { type: 'command', data: { type: 'CHECK_CHROME' } });
        }, 2000);
        return () => clearTimeout(timer);
    }, [emit]);

    // Flush update buffer
    useEffect(() => {
        const flushInterval = setInterval(() => {
            if (updateBuffer.current.length === 0) return;
            dispatchLiveFeed({ type: 'ADD_ITEMS', items: [...updateBuffer.current] });
            updateBuffer.current = [];
        }, 200);
        return () => clearInterval(flushInterval);
    }, []);

    // Keep alive
    useEffect(() => {
        const keepAliveInt = setInterval(() => {
            if (typeof window !== 'undefined') window.postMessage({ type: 'DASHBOARD_PING', ts: Date.now() }, '*');
        }, 25000);
        return () => clearInterval(keepAliveInt);
    }, []);

    // Consolidated WebSocket event handling and helper definitions.

    // 🛡️ v11.0: Track sent browser commands to prevent duplicates
    const sentBrowserCommands = React.useRef<Set<string>>(new Set());

    const toggleAccount = (acc: 'A' | 'B') => {
        if (toggleLock.current[acc]) return; // Prevent double-click
        toggleLock.current[acc] = true;
        setTimeout(() => toggleLock.current[acc] = false, 2000); // 2 sec cooldown (increased)

        const currentUrl = acc === 'A' ? config.urlA : config.urlB;

        // Calculate Next State
        const currentActive = acc === 'A' ? systemStatus.accountA_active : systemStatus.accountB_active;
        const newActive = !currentActive;

        // 1. Optimistic Update with FULL RESET when toggle OFF
        setSystemStatus(prev => {
            if (acc === 'A') {
                return {
                    ...prev,
                    accountA_active: newActive,
                    ...(newActive === false && {
                        balanceA: '0.00',
                        profit_session: '0.00',
                        providers: { ...prev.providers, A1: 'INACTIVE', A2: 'INACTIVE', A3: 'INACTIVE', A4: 'INACTIVE', A5: 'INACTIVE' }
                    })
                };
            } else {
                return {
                    ...prev,
                    accountB_active: newActive,
                    ...(newActive === false && {
                        balanceB: '0.00',
                        profit_session: '0.00',
                        providers: { ...prev.providers, B1: 'INACTIVE', B2: 'INACTIVE', B3: 'INACTIVE', B4: 'INACTIVE', B5: 'INACTIVE' }
                    })
                };
            }
        });
        
        // 🛡️ v11.0: Reset event counts when toggle OFF
        if (newActive === false) {
            if (acc === 'A') setActiveEventsA(0);
            else setActiveEventsB(0);
            // Clear live feed for this account
            dispatchLiveFeed({ type: 'CLEAR' });
        }

        // 🧹 Clear GuardianStatus for this account when toggled OFF (Ghost Prevention)
        if (newActive === false) {
            setGuardianStatus((prev: any) => {
                const cleaned: any = {};
                for (const key of Object.keys(prev)) {
                    // Keep only entries NOT belonging to this account
                    if (!key.startsWith(`${acc}:`)) {
                        cleaned[key] = prev[key];
                    }
                }
                console.log(`[FRONTEND] 🧹 Cleared guardianStatus for account ${acc}`, cleaned);
                return cleaned;
            });
        }

        // 2. Send Command (toggle state only - no browser open via WebSocket)
        emit('command', { type: 'TOGGLE_ACCOUNT', payload: { account: acc, active: newActive } });

        if (newActive === true && currentUrl && currentUrl.trim() !== '') {
            // 🚀 v12.0: Direct HTTP call to launch Chrome - NO WEBSOCKET
            // This prevents all the duplicate issues from complex event chains
            const commandKey = `${acc}_browser`;
            if (sentBrowserCommands.current.has(commandKey)) {
                console.log(`[AUDIT] SKIPPED duplicate launch for ${acc}`);
                return;
            }
            sentBrowserCommands.current.add(commandKey);
            setTimeout(() => sentBrowserCommands.current.delete(commandKey), 5000);

            addLog(`Account ${acc} activated - Launching Chrome...`);
            
            // Direct HTTP POST to backend - simple and reliable
            fetch(`${BACKEND_HTTP}/api/launch-chrome`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: acc, url: currentUrl })
            })
            .then(response => response.json())
            .then(result => {
                console.log(`[LAUNCHER] Chrome launch result:`, result);
                addLog(`Chrome ${result.success ? 'launched' : 'failed'}: ${result.message}`);
            })
            .catch((error: any) => {
                console.error(`[LAUNCHER] Failed to launch Chrome:`, error);
                addLog(`Chrome launch error: ${error.message}`);
            });
        } else {
            addLog(`Account ${acc} ${newActive ? 'activated' : 'deactivated'}${newActive === false ? ' - All data reset to default' : ''}`);
        }
    };
    const applyConfig = () => {
        addLog('Configuration applied.');
        emit('command', { type: 'UPDATE_CONFIG', payload: config });
    };

    const registerContract = (url: string, provider: string) => {
        // Extract a clean pattern from URL
        // Simple heuristic: parts after domain
        let pattern = url;
        try {
            const urlObj = new URL(url);
            pattern = urlObj.pathname.split('/').pop() || urlObj.pathname;
            if (pattern.length < 5) pattern = urlObj.pathname; // use full path if too short
        } catch (e) { }

        addLog(`Registering contract: ${pattern} as ${provider}...`);
        emit('command', {
            type: 'register_contract',
            data: { pattern, provider }
        });

        // Remove from list
        setUnknownTraffic(prev => prev.filter(t => t.url !== url));
    };

    // 🔥 v3.5.5 EMERGENCY BYPASS: No filters, just raw data dump
    const filteredFeed = liveFeed.slice(0, 20);

    return (
        <div className="bg-[#0f172a] text-slate-200 min-h-screen font-sans selection:bg-blue-500/30">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
                .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scroll::-webkit-scrollbar-track { background: #1a2332; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #2a374f; border-radius: 4px; }
                @keyframes pulse-glow { 0%, 100% { opacity: 1; box-shadow: 0 0 5px currentColor; } 50% { opacity: 0.7; box-shadow: 0 0 2px currentColor; } }
                .lamp-active { animation: pulse-glow 2s infinite; }
            `}</style>

            {/* HEADER */}
            <header className="flex items-center justify-between border-b border-[#2a374f] bg-[#1a2332] px-6 py-3 h-16 shrink-0 z-20">
                <div className="flex items-center gap-4 text-white">
                    <div className="size-8 flex items-center justify-center bg-[#2b6cee]/20 rounded-lg text-[#2b6cee]">
                        <span className="material-symbols-outlined">analytics</span>
                    </div>
                    <h2 className="text-lg font-bold">Bot Config & Monitor v2.0</h2>
                </div>
                <div className="flex items-center gap-6">
                    {/* Chrome Status Indicator */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                        chromeStatus.connected 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}>
                        <span className={`size-2 rounded-full ${chromeStatus.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span>Chrome {chromeStatus.connected ? `(${chromeStatus.tabs} tabs)` : 'Offline'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span className={`size-2 rounded-full ${
                            ready ? 'bg-[#22c55e] lamp-active' : 
                            connected ? 'bg-yellow-500 lamp-active' : 
                            'bg-[#ef4444]'
                        }`}></span>
                        <span>{ready ? 'SYSTEM READY' : connected ? 'System Online' : 'Offline'}</span>
                    </div>
                    <div className="h-8 w-[1px] bg-[#2a374f]"></div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white">Admin User</span>
                        <div className="size-9 rounded-full bg-slate-600 border-2 border-[#2b6cee]/30"></div>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* SIDEBAR */}
                <aside className="w-80 flex flex-col border-r border-[#2a374f] bg-[#1a2332] overflow-y-auto custom-scroll shrink-0 z-10">
                    <div className="p-5 space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-[#2a374f]">
                            <span className="material-symbols-outlined text-[#2b6cee] text-xl">tune</span>
                            <h3 className="text-white font-bold text-sm uppercase tracking-wider">Global Filters</h3>
                        </div>

                        {/* Match Source */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Match Source</label>
                            <div className="flex h-9 w-full bg-[#101622] rounded-lg p-1 gap-1">
                                {['Live', 'Prematch', 'Both'].map(t => (
                                    <button key={t} onClick={() => setConfig({ ...config, matchType: t })} className={`flex-1 rounded-md text-xs font-medium transition-colors ${config.matchType === t ? 'bg-[#2b6cee] text-white' : 'text-slate-400 hover:bg-white/5'}`}>{t}</button>
                                ))}
                            </div>
                        </div>

                        {/* Profit Inputs */}
                        <div className="space-y-4">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Profit Min/Max %</label>
                            <div className="flex items-center gap-2">
                                <div className="bg-[#101622] border border-[#2a374f] rounded-lg p-1 flex-1">
                                    <input type="number" step="0.1" value={config.minProfit} onChange={e => setConfig({ ...config, minProfit: parseFloat(e.target.value) })} className="w-full bg-transparent border-none text-sm text-white text-center focus:outline-none" placeholder="Min" />
                                </div>
                                <span className="text-slate-500">-</span>
                                <div className="bg-[#101622] border border-[#2a374f] rounded-lg p-1 flex-1">
                                    <input type="number" step="0.1" value={config.maxProfit} onChange={e => setConfig({ ...config, maxProfit: parseFloat(e.target.value) })} className="w-full bg-transparent border-none text-sm text-white text-center focus:outline-none" placeholder="Max" />
                                </div>
                            </div>
                        </div>

                        {/* Round Off */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Round Off Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-500 material-symbols-outlined text-sm">money</span>
                                <input type="number" step="0.1" value={config.roundOff} onChange={e => setConfig({ ...config, roundOff: parseFloat(e.target.value) })} className="w-full bg-[#101622] border border-[#2a374f] rounded-lg text-sm text-white py-2 pl-9 pr-3 focus:outline-none focus:border-[#2b6cee]" />
                            </div>
                        </div>

                        {/* Market Types */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Market Types</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(config.marketTypes).map(([k, v]) => (
                                    <label key={k} className="flex items-center gap-2 p-2 rounded bg-[#101622]/50 border border-[#2a374f] cursor-pointer hover:bg-[#101622]">
                                        <input type="checkbox" checked={v} onChange={() => setConfig({ ...config, marketTypes: { ...config.marketTypes, [k]: !v } })} className="rounded border-[#2a374f] bg-[#1a2332] text-[#2b6cee]" />
                                        <span className="text-xs font-medium text-slate-300 uppercase">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Stake Config */}
                        <div className="space-y-4 pt-4 border-t border-[#2a374f]">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#2b6cee] text-xl">payments</span>
                                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Stake Config</h3>
                            </div>
                            {Object.entries(config.tiers).map(([key, tier], i) => (
                                <div key={key} className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs text-slate-400 capitalize">Stake Level {i + 1}</label>
                                        <input
                                            type="checkbox"
                                            checked={tier.active}
                                            onChange={() => setConfig({
                                                ...config,
                                                tiers: {
                                                    ...config.tiers,
                                                    [key]: { ...tier, active: !tier.active }
                                                } as any
                                            })}
                                            className="size-3 rounded border-slate-700 bg-[#1a2332] text-[#2b6cee]"
                                        />
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-500 text-[10px]">$</span>
                                        <input
                                            type="number"
                                            value={tier.amount}
                                            onChange={e => setConfig({
                                                ...config,
                                                tiers: {
                                                    ...config.tiers,
                                                    [key]: { ...tier, amount: parseFloat(e.target.value) }
                                                } as any
                                            })}
                                            className="w-full bg-[#101622] border border-[#2a374f] rounded-lg text-xs text-white py-1.5 pl-7 pr-3 focus:outline-none focus:border-[#2b6cee]"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 🚀 Developer Tools (v7.0 Stress-Prod) */}
                        <div className="space-y-4 pt-4 border-t border-[#2a374f]">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#ef4444] text-xl">bug_report</span>
                                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Developer Tools</h3>
                            </div>
                            <div className="bg-[#101622] rounded p-3 border border-[#2a374f] space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Heap Memory:</span>
                                    <span className="text-white font-mono">{stressMetrics.heap} MB</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">WS Drops:</span>
                                    <span className="text-orange-400 font-bold">{stressMetrics.wsDrops}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Malformed:</span>
                                    <span className="text-red-400 font-bold">{stressMetrics.malformed}</span>
                                </div>
                            </div>
                            {!stressMetrics.active ? (
                                <button onClick={() => {
                                    setStressMetrics(p => ({ ...p, active: true }));
                                    emit('command', { type: 'START_STRESS' });
                                }} className="w-full bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] font-bold py-2 rounded border border-[#ef4444]/30 text-xs transition-colors">
                                    🚀 Run STRESS-PROD (15m)
                                </button>
                            ) : (
                                <button onClick={() => {
                                    emit('command', { type: 'STOP_STRESS' });
                                }} className="w-full bg-[#ef4444] hover:bg-red-600 text-white font-bold py-2 rounded text-xs animate-pulse">
                                    🛑 Stopping Simulation...
                                </button>
                            )}
                        </div>

                        {/* 🕵️ Traffic Inspector (v4.0) */}
                        {unknownTraffic.length > 0 && (
                            <div className="space-y-4 pt-4 border-t border-[#2a374f]">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-orange-400 text-xl">radar</span>
                                    <h3 className="text-white font-bold text-sm uppercase tracking-wider">Traffic Inspector</h3>
                                </div>
                                <div className="space-y-2">
                                    {unknownTraffic.map((t, idx) => (
                                        <div key={idx} className="bg-orange-500/10 border border-orange-500/30 rounded p-2 space-y-2">
                                            <div className="text-[10px] text-orange-400 font-bold uppercase">Unknown Data Captured ({t.confidence}%)</div>
                                            <div className="text-[10px] text-slate-400 truncate" title={t.url}>{t.url}</div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => registerContract(t.url, 'SABA')}
                                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold py-1 rounded"
                                                >
                                                    AS SABA
                                                </button>
                                                <button
                                                    onClick={() => registerContract(t.url, 'AFB88')}
                                                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-[9px] font-bold py-1 rounded"
                                                >
                                                    AS AFB
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 mt-auto">
                            <button onClick={applyConfig} className="w-full bg-[#2b6cee] hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg active:scale-95 flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">save</span> Apply Configuration
                            </button>
                        </div>
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main className="flex-1 flex flex-col min-w-0 bg-[#101622]/50 p-4 gap-4 overflow-hidden">
                    {/* ACCOUNTS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0 h-auto">
                        {['A', 'B'].map((acc) => {
                            const isA = acc === 'A';
                            const active = isA ? systemStatus.accountA_active : systemStatus.accountB_active;

                            // -- PIPELINE HEALTH DRIVER FOR LAMP COLOR --
                            // This ensures the lamp reflects REAL BACKEND FLOW, not just UI Toggle
                            const healthColor = pipelineHealth.status === 'GREEN' ? 'bg-[#22c55e]' :
                                pipelineHealth.status === 'YELLOW' ? 'bg-[#facc15]' : 'bg-[#ef4444]';

                            // If UI is OFF, show gray/red. If UI is ON, show Pipeline Status.
                            const lampClass = active ? healthColor : 'bg-slate-600';
                            const statusText = active ? (pipelineHealth.status === 'GREEN' ? 'Flowing' : pipelineHealth.reason) : 'Inactive';

                            const color = isA ? 'blue' : 'purple';
                            const hex = isA ? '#2b6cee' : '#a855f7';

                            return (
                                <div key={acc} className={`bg-[#1a2332] border border-[#2a374f] rounded-lg p-4 flex flex-col gap-3 shadow-sm ${!active && 'opacity-90'}`}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-8 rounded bg-${color}-900/30 text-${color}-400 flex items-center justify-center font-bold text-sm border border-${color}-900/50`}>{acc}</div>
                                            <div>
                                                <h4 className="text-white text-sm font-semibold">{isA ? 'Primary Account' : 'Secondary Account'}</h4>
                                                <div title={active ? pipelineHealth.reason : 'Account Disabled'} className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 cursor-help">
                                                    {/* Status indicator driven by Pipeline Health */}
                                                    <span className={`size-1.5 rounded-full ${lampClass} ${active && pipelineHealth.status === 'GREEN' ? 'lamp-active' : ''}`}></span>
                                                    <span>{statusText}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={active} onChange={() => toggleAccount(acc as 'A' | 'B')} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-[#22c55e] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                        </label>
                                    </div>
                                    {/* Provider Dropdown */}
                                    <div className="flex items-center gap-2">
                                        <select 
                                            value={isA ? config.providerA : config.providerB}
                                            onChange={e => setConfig({ ...config, [isA ? 'providerA' : 'providerB']: e.target.value })}
                                            className="bg-[#101622] border border-[#2a374f] rounded px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-[#2b6cee] cursor-pointer"
                                        >
                                            <option value="SABA">SABA</option>
                                            <option value="AFB88">AFB88</option>
                                            <option value="CMD368">CMD368</option>
                                            <option value="MAXBET">MAXBET</option>
                                        </select>
                                        <div className="relative bg-[#101622] rounded border border-[#2a374f] p-2 flex items-center gap-2 flex-1">
                                            <span className="material-symbols-outlined text-slate-500 text-[18px]">link</span>
                                            <input 
                                                className="bg-transparent border-none text-slate-300 text-xs w-full p-0 focus:outline-none font-mono" 
                                                value={isA ? config.urlA : config.urlB} 
                                                onChange={e => setConfig({ ...config, [isA ? 'urlA' : 'urlB']: e.target.value })} 
                                                placeholder="Enter site URL (e.g. qq188.com)"
                                            />
                                        </div>
                                    </div>

                                    {/* Stats Grid: Balance, Events, Ping */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-[#101622] rounded p-2 border border-[#2a374f]/50">
                                            <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Balance</span>
                                            <span className="text-base font-bold text-white font-mono">{isA ? systemStatus.balanceA : systemStatus.balanceB}</span>
                                        </div>
                                        <div className="bg-[#101622] rounded p-2 border border-[#2a374f]/50">
                                            <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Events</span>
                                            <span className={`text-base font-bold font-mono ${(isA ? activeEventsA : activeEventsB) > 0 ? 'text-[#22c55e]' : 'text-slate-500'}`}>
                                                {isA ? activeEventsA : activeEventsB}
                                            </span>
                                        </div>
                                        <div className="bg-[#101622] rounded p-2 border border-[#2a374f]/50">
                                            <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Ping</span>
                                            <span className="text-base font-bold text-[#22c55e] font-mono">{(isA ? pingA : pingB) || '--'} ms</span>
                                        </div>
                                    </div>

                                    {/* 🛡️ DRAWDOWN / P&L Section */}
                                    <div className={`rounded-lg p-2.5 border ${
                                        (isA ? drawdown.A.netPL : drawdown.B.netPL) >= 0 
                                            ? 'bg-green-500/5 border-green-500/20' 
                                            : 'bg-red-500/5 border-red-500/20'
                                    }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] text-slate-400 uppercase font-medium">Session P&L</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                                    (isA ? drawdown.A.streak : drawdown.B.streak) > 0 
                                                        ? 'bg-green-500/20 text-green-400' 
                                                        : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                    {(isA ? drawdown.A.streak : drawdown.B.streak) > 0 ? '🔥' : '❄️'} 
                                                    {Math.abs(isA ? drawdown.A.streak : drawdown.B.streak)}
                                                    {(isA ? drawdown.A.streak : drawdown.B.streak) > 0 ? 'W' : 'L'}
                                                </span>
                                                <span className="text-[9px] text-slate-500">
                                                    {isA ? drawdown.A.winRate : drawdown.B.winRate}% WR
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            <div className="text-center">
                                                <div className="text-[9px] text-slate-500 mb-0.5">Net P/L</div>
                                                <div className={`text-sm font-bold font-mono ${
                                                    (isA ? drawdown.A.netPL : drawdown.B.netPL) >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                    {(isA ? drawdown.A.netPL : drawdown.B.netPL) >= 0 ? '+' : ''}
                                                    ${(isA ? drawdown.A.netPL : drawdown.B.netPL).toFixed(0)}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[9px] text-slate-500 mb-0.5">Profit</div>
                                                <div className="text-sm font-bold font-mono text-green-400">
                                                    +${(isA ? drawdown.A.profit : drawdown.B.profit).toFixed(0)}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[9px] text-slate-500 mb-0.5">Loss</div>
                                                <div className="text-sm font-bold font-mono text-red-400">
                                                    -${(isA ? drawdown.A.loss : drawdown.B.loss).toFixed(0)}
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[9px] text-slate-500 mb-0.5">Trades</div>
                                                <div className="text-sm font-bold font-mono text-slate-300">
                                                    {isA ? drawdown.A.trades : drawdown.B.trades}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Provider Status Badges - Shows active provider names */}
                                    <div className="flex items-center gap-2 justify-between bg-[#101622]/30 p-2 rounded border border-[#2a374f]/30">
                                        <div className="text-[10px] text-slate-400 uppercase font-medium">Active Providers</div>
                                        <div className="flex gap-2">
                                            {(() => {
                                                // Get current provider for this account
                                                const currentProvider = isA ? config.providerA : config.providerB;
                                                const providerAbbrev: { [key: string]: string } = {
                                                    'SABA': 'SBA',
                                                    'AFB88': 'AFB',
                                                    'CMD368': 'CMD',
                                                    'MAXBET': 'MAX',
                                                    'BTI': 'BTI',
                                                    'SBO': 'SBO'
                                                };
                                                
                                                // Show current selected provider as active
                                                const abbrev = providerAbbrev[currentProvider] || currentProvider?.substring(0, 3).toUpperCase();
                                                const isLive = active && (isA ? activeEventsA > 0 : activeEventsB > 0);
                                                
                                                // Restore previous single-badge design and add two hardcoded lamps (SABA, AFB88)
                                                const acctKey = isA ? 'A' : 'B';
                                                const stat = (providerStatuses && providerStatuses[acctKey]) || {};
                                                const primary = stat.primary || null;
                                                const lampClassFor = (name: string) => {
                                                    if (primary && primary.label && primary.label.toUpperCase().includes(name.toUpperCase())) {
                                                        if (primary.state === 'on') return 'bg-green-400';
                                                        if (primary.state === 'warn') return 'bg-yellow-400';
                                                    }
                                                    return 'bg-slate-500';
                                                };

                                                return (
                                                    <div className={`relative flex items-center gap-2 px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                                                        isLive ? 'bg-green-500/10 text-green-300 border border-green-500/20' : active ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20' : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                                                    }`}>
                                                        <div className="flex items-center gap-2">
                                                            <div className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all bg-slate-700/50 text-slate-500 border border-slate-600/30">
                                                                <span className={`h-2 w-2 rounded-full ${lampClassFor('SABA')}`}></span>
                                                                <span>SBA</span>
                                                            </div>
                                                            <div className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all bg-slate-700/50 text-slate-500 border border-slate-600/30">
                                                                <span className={`h-2 w-2 rounded-full ${lampClassFor('AFB88')}`}></span>
                                                                <span>AFB</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {isLive && <span className="text-[9px] opacity-70">LIVE</span>}
                                                            {!isLive && active && <span className="text-[9px] opacity-70">IDLE</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex flex-col gap-4 flex-1 min-h-0">
                        {/* EXECUTION HISTORY */}
                        <div className="flex-1 bg-[#1a2332] border border-[#2a374f] rounded-lg flex flex-col min-h-0 shadow-sm">
                            <div className="px-4 py-3 border-b border-[#2a374f] flex justify-between items-center bg-[#101622]/20">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#2b6cee] text-sm">history</span>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Execution History</h3>
                                    </div>
                                    {/* Date Picker Mockup */}
                                    <div className="hidden md:flex items-center bg-[#101622] border border-[#2a374f] rounded overflow-hidden">
                                        <span className="text-slate-400 text-[10px] px-2 py-1">2023-11-14 - 2023-11-15</span>
                                    </div>
                                    <button
                                        onClick={() => setSilentMode(!silentMode)}
                                        className={`p-1 rounded ${silentMode ? 'text-slate-500' : 'text-[#22c55e]'} hover:bg-white/5 transition-colors`}
                                        title={silentMode ? "Unmute Notifications" : "Mute Notifications"}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">{silentMode ? 'volume_off' : 'volume_up'}</span>
                                    </button>
                                </div>
                                <div className="text-xs text-slate-400">Total: <span className="text-[#3b82f6] font-bold">+{systemStatus.profit_session}%</span></div>
                            </div>
                            <div className="flex-1 overflow-auto custom-scroll">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-[#1a2332] z-10 text-[10px] uppercase text-slate-400 font-semibold tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-[#2a374f] text-center">Time</th>
                                            <th className="px-4 py-3 border-b border-[#2a374f] text-center">Provider</th>
                                            <th className="px-4 py-3 border-b border-[#2a374f] text-center">Match</th>
                                            <th className="px-4 py-3 border-b border-[#2a374f] text-center">Pick</th>
                                            <th className="px-4 py-3 border-b border-[#2a374f] text-center">Odds</th>
                                            <th className="px-4 py-3 border-b border-[#2a374f] text-center">Stake</th>
                                            <th className="px-4 py-3 border-b border-[#2a374f] text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs divide-y divide-[#2a374f]">
                                        {executionHistory.length === 0 ? <tr className="text-slate-500 italic"><td colSpan={7} className="text-center py-4">No data.</td></tr> : executionHistory.map(row => (
                                            <React.Fragment key={row.id}>
                                                {/* Row 1: Team A */}
                                                <tr className="bg-[#1a2332]/50 hover:bg-white/5 border-b-0">
                                                    <td className="px-4 py-2 align-middle text-center text-slate-500 font-mono text-[10px]">{new Date(row.timestamp).toLocaleTimeString()}</td>
                                                    <td className="px-4 py-2 align-middle text-center text-slate-400">{row.providerA}</td>
                                                    <td className="px-4 py-2 align-middle text-center text-white">{row.teamA}</td>
                                                    <td className="px-4 py-2 align-middle text-center text-slate-300 font-mono text-[11px] whitespace-nowrap">{row.type}</td>
                                                    <td className="px-4 py-2 align-middle text-center text-[#22c55e] font-bold font-mono">{parseFloat(row.oddsA).toFixed(2)}</td>
                                                    <td className="px-4 py-2 align-middle text-center text-white font-mono">$ {row.amount}</td>

                                                    {/* Status Row 1 */}
                                                    <td className={`px-4 py-2 align-middle text-center font-bold font-mono text-xs border-l border-[#2a374f] ${row.status === 'SUCCESS' ? 'text-[#22c55e]' : 'text-orange-400'}`}>
                                                        {row.status}
                                                    </td>
                                                </tr>
                                                {/* Row 2: Team B */}
                                                <tr className="bg-[#1a2332]/50 hover:bg-white/5 border-b border-[#2a374f]">
                                                    <td className="px-4 py-2 align-middle text-center text-slate-600 font-mono text-[10px]">{new Date(row.timestamp).toLocaleTimeString()}</td>
                                                    <td className="px-4 py-2 align-middle text-center text-slate-400">{row.providerB}</td>
                                                    <td className="px-4 py-2 align-middle text-center text-white">{row.teamB}</td>
                                                    <td className="px-4 py-2 align-middle text-center text-slate-300 font-mono text-[11px] whitespace-nowrap">{row.type}</td>
                                                    <td className="px-4 py-2 align-middle text-center text-[#22c55e] font-bold font-mono">{parseFloat(row.oddsB).toFixed(2)}</td>
                                                    <td className="px-4 py-2 align-middle text-center text-white font-mono">$ {row.amount}</td>
                                                    <td className={`px-4 py-2 align-middle text-center font-bold font-mono text-xs border-l border-[#2a374f] ${row.status === 'SUCCESS' ? 'text-[#22c55e]' : 'text-orange-400'}`}>
                                                        {row.status}
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* LIVE SCANNER */}
                        <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden shadow-xl">
                            <div className="px-6 py-4 bg-[#1e293b] border-b border-[#334155] flex justify-between items-center bg-gradient-to-r from-[#1e293b] to-[#0f172a]">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <span className="text-blue-400 text-xl">🎯</span>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white tracking-wide">LIVE SCANNER</h2>
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-2 w-2 relative">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">Running</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-[#0f172a] px-3 py-1.5 rounded-lg border border-[#334155] hover:border-blue-500/50 transition-colors select-none">
                                        <input
                                            type="checkbox"
                                            checked={showPairsOnly}
                                            onChange={(e) => setShowPairsOnly(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-offset-0 focus:ring-0 bg-[#1e293b]"
                                        />
                                        <span className="text-sm text-slate-300 font-medium">Pairs Only</span>
                                    </label>

                                    <button
                                        onClick={() => dispatchLiveFeed({ type: 'CLEAR' })}
                                        className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-[#0f172a] border border-[#334155] rounded-lg hover:border-red-500/50 transition-all active:scale-95"
                                    >
                                        Clear Table
                                    </button>
                                </div>
                            </div>

                            <div className="h-[500px]">
                                <TableVirtuoso
                                    data={filteredFeed}
                                    totalCount={filteredFeed.length}
                                    style={{ height: '100%' }}
                                    components={{
                                        Table: ({ ...props }) => <table {...props} className="w-full text-left border-collapse" />,
                                        TableHead: React.forwardRef(function TableHead(props, ref) {
                                            return <thead {...props} ref={ref as any} className="bg-[#1e293b] text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-[#334155] sticky top-0 z-20" />;
                                        }),
                                        TableRow: ({ item, ...props }) => (
                                            <React.Fragment key={item?.id}>
                                                {/* Render two rows per item inside TBODY if possible, but Virtuoso prefers 1 item = 1 row wrapper. 
                                                    Workaround: Return a TBODY-like structure or just two tables rows in a fragment */}
                                                {props.children}
                                            </React.Fragment>
                                        )
                                    }}
                                    fixedHeaderContent={() => (
                                        <tr>
                                            <th className="px-3 py-3 text-center w-[80px]">Time</th>
                                            <th className="px-3 py-3 text-center w-[110px]">Account</th>
                                            <th className="px-3 py-3 text-center w-[200px]">Match</th>
                                            <th className="px-3 py-3 text-center w-[140px]">Pick</th>
                                            <th className="px-3 py-3 text-center w-[70px]">Odds</th>
                                            <th className="px-3 py-3 text-center w-[80px]">Profit</th>
                                            <th className="px-3 py-3 text-center w-[80px]">Action</th>
                                        </tr>
                                    )}
                                    itemContent={(index, row) => {
                                        if (!row) return null;
                                        const simplifyPick = (market: string, selection: string, line: string) => {
                                            const m = (market || '').replace('FT_', 'FT ').replace('HT_', 'HT ').toUpperCase();
                                            const s = (selection || '').replace('Over', 'O').replace('Under', 'U').replace('Home', 'H').replace('Away', 'A');
                                            let l = (line || '').replace(/\?/g, '').replace(/\s+/g, ' ');
                                            return `${m} ${s} ${l}`;
                                        };
                                        const pickA = simplifyPick(row.market, row.selection, row.line);
                                        const pickB = simplifyPick(row.marketB || row.market, row.selectionB, row.lineB);
                                        const oddsANum = parseFloat(row.odds);
                                        const oddsBNum = parseFloat(row.oddsB);
                                        const oddsA = isNaN(oddsANum) ? '-' : oddsANum.toFixed(2);
                                        const oddsB = isNaN(oddsBNum) ? '-' : oddsBNum.toFixed(2);
                                        // Odds color: red if < 2, green if >= 2
                                        const oddsAColor = oddsANum >= 2 ? 'text-[#22c55e]' : 'text-[#ef4444]';
                                        const oddsBColor = oddsBNum >= 2 ? 'text-[#22c55e]' : 'text-[#ef4444]';

                                        return (
                                            <>
                                                <tr className="bg-[#0f172a]/30 hover:bg-white/5 cursor-pointer border-b-0 group transition-colors">
                                                    <td className="px-3 py-2 align-middle text-center text-slate-500 font-mono text-[10px] w-[80px]">{new Date(row.timestamp).toLocaleTimeString([], { hour12: false })}</td>
                                                    <td className="px-3 py-2 align-middle text-center w-[110px]">
                                                        <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded font-bold">{row.account}/{row.bookmaker}</span>
                                                    </td>
                                                    <td className="px-3 py-2 align-middle text-center text-white font-bold tracking-wide w-[200px]">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {row.home}
                                                            {row.state === 'POTENTIAL' && (
                                                                <span className="bg-orange-500/20 text-orange-400 text-[9px] px-1.5 py-0.5 rounded border border-orange-500/30 font-black animate-pulse">POTENTIAL</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 align-middle text-center text-slate-300 font-mono text-[11px] whitespace-nowrap w-[140px]">{pickA}</td>
                                                    <td className={`px-3 py-2 align-middle text-center font-bold font-mono text-sm w-[70px] ${oddsAColor}`}>{oddsA}</td>
                                                    <td rowSpan={2} className="px-3 py-2 align-middle text-center text-[#2b6cee] font-black text-lg bg-[#1e293b]/50 border-l border-[#334155] shadow-inner w-[80px]">
                                                        {(row.profit && !isNaN(parseFloat(row.profit))) ? `${row.profit}%` : '-'}
                                                    </td>
                                                    <td rowSpan={2} className="px-3 py-2 align-middle text-center w-[80px] border-l border-[#334155]">
                                                        <button 
                                                            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-lg transition-all active:scale-95 whitespace-nowrap"
                                                            title="Focus tab untuk bet manual"
                                                        >
                                                            🎯 BET
                                                        </button>
                                                    </td>
                                                </tr>
                                                <tr className="bg-[#0f172a]/30 hover:bg-white/5 cursor-pointer border-b border-[#334155] group transition-colors">
                                                    <td className="px-3 py-2 align-middle text-center text-slate-600 font-mono text-[10px] w-[80px]">{new Date(row.timestamp).toLocaleTimeString([], { hour12: false })}</td>
                                                    <td className="px-3 py-2 align-middle text-center w-[110px]">
                                                        <span className="bg-purple-500/20 text-purple-400 text-[10px] px-2 py-0.5 rounded font-bold">{row.accountB}/{row.bookmakerB}</span>
                                                    </td>
                                                    <td className="px-3 py-2 align-middle text-center text-white font-bold tracking-wide w-[200px]">{row.away}</td>
                                                    <td className="px-3 py-2 align-middle text-center text-slate-300 font-mono text-[11px] whitespace-nowrap w-[140px]">{pickB}</td>
                                                    <td className={`px-3 py-2 align-middle text-center font-bold font-mono text-sm w-[70px] ${oddsBColor}`}>{oddsB}</td>
                                                </tr>
                                            </>
                                        );
                                    }}
                                />
                                {filteredFeed.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-500 italic">
                                        {scannerError ? (
                                            <>
                                                <span className="text-3xl">⚠️</span>
                                                <span className="font-semibold text-yellow-400">{scannerError.type.replace('_', ' ')}</span>
                                                <span className="text-xs text-slate-400">{scannerError.message}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-3xl opacity-20">youtube_searched_for</span>
                                                <span>{showPairsOnly ? "Waiting for arbitrage pairs..." : "Scanning for odds..."}</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* FOOTER / LOGS */}
                    <div className="flex flex-col bg-[#1a2332] border border-[#2a374f] rounded-lg shrink-0 h-48 shadow-sm overflow-hidden">
                        <div className="flex border-b border-[#2a374f] bg-[#101622]/30">
                            <button className="px-4 py-2 text-xs font-medium text-[#2b6cee] border-b-2 border-[#2b6cee] bg-[#1a2332]">All Logs</button>
                            <div className="ml-auto flex items-center pr-2"><span onClick={() => setLogs([])} className="text-[10px] text-slate-500 cursor-pointer hover:text-white">Clear</span></div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scroll p-2 bg-[#0c1017] font-mono text-[11px] leading-relaxed">
                            {logs.map((log, i) => <div key={i} className="text-slate-400">{log}</div>)}
                        </div>
                        <div className="bg-[#1a2332] border-t border-[#2a374f] px-4 py-2 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-6">
                                {['GATEWAY', 'REDIS', 'WEBSOCKET', 'QUEUE (0)', 'WORKERS (4/4)'].map(sys => (
                                    <div key={sys} className="flex items-center gap-2">
                                        <span className={`size-2 rounded-full ${connected ? 'bg-[#22c55e] lamp-active' : 'bg-slate-600'}`}></span>
                                        <span className="text-[10px] font-bold text-slate-300 tracking-wider">{sys}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="bg-[#0f172a] border border-[#2a374f] px-3 py-1 rounded flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold">OIPM A</span>
                                    <span className={`text-xs font-mono font-bold ${oipm.A > 0 ? 'text-[#0ff]' : 'text-slate-600'}`}>{oipm.A.toLocaleString()}</span>
                                </div>
                                <div className="bg-[#0f172a] border border-[#2a374f] px-3 py-1 rounded flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold">OIPM B</span>
                                    <span className={`text-xs font-mono font-bold ${oipm.B > 0 ? 'text-[#0ff]' : 'text-slate-600'}`}>{oipm.B.toLocaleString()}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">Build: v7.5.0-gold</div>
                            </div>
                        </div>
                    </div>
                </main>
            </div >
        </div >
    );
}
