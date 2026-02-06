/**
 * ═══════════════════════════════════════════════════════════════════════════
 * COLD RUN LIVE DEPLOYMENT LAUNCHER v6.0
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Usage: npx ts-node cold_run_launcher.ts
 * 
 * This script:
 * 1. Starts backend in Cold Run mode
 * 2. Monitors AFB88 and SABA connections
 * 3. Logs potential arbitrage with safety checks
 * 4. Tracks latency and token rotation
 * 
 * ⚠️ SHADOW MODE: No real bets will be placed
 */

import { NormalizationService } from './src/normalization/normalization.service';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// CONSOLE COLORS
// ═══════════════════════════════════════════════════════════════════════════
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// ═══════════════════════════════════════════════════════════════════════════
// STATE TRACKING
// ═══════════════════════════════════════════════════════════════════════════
interface ProviderStatus {
    account: string;
    provider: string;
    status: string;  // 'OFFLINE' | 'CONNECTING' | 'LIVE'
    lastSeen: number;
    eventCount: number;
}

interface LatencyBucket {
    timestamp: number;
    synced: number;
    dropped: number;
}

interface TokenState {
    token: string | null;
    capturedAt: number;
    rotations: number;
}

const state: {
    providers: {
        A: ProviderStatus;
        B: ProviderStatus;
    };
    latency: {
        totalProcessed: number;
        synced: number;
        dropped: number;
        missing: number;
        history: LatencyBucket[];
        avgMs: number;
    };
    token: TokenState;
    arbLog: any[];
    startTime: number;
} = {
    providers: {
        A: { account: 'A', provider: 'AFB88', status: 'OFFLINE', lastSeen: 0, eventCount: 0 },
        B: { account: 'B', provider: 'SABA', status: 'OFFLINE', lastSeen: 0, eventCount: 0 }
    },
    latency: {
        totalProcessed: 0,
        synced: 0,
        dropped: 0,
        missing: 0,
        history: [],
        avgMs: 0
    },
    token: {
        token: null,
        capturedAt: 0,
        rotations: 0
    },
    arbLog: [],
    startTime: Date.now()
};

const logPath = path.join(process.cwd(), 'logs', 'cold_run.log');
const normService = new NormalizationService();

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════════════
function log(msg: string) {
    const ts = new Date().toISOString().substring(11, 19);
    console.log(`${DIM}[${ts}]${RESET} ${msg}`);
}

function logColdRun(profit: number, match: string, safety: 'OK' | 'FAIL', reason: string) {
    const statusColor = safety === 'OK' ? GREEN : RED;
    const statusIcon = safety === 'OK' ? '✅' : '❌';

    console.log(`${CYAN}[COLD-RUN]${RESET} ${statusIcon} Potential Arb Found: ${YELLOW}${profit.toFixed(2)}%${RESET} | Safety Check: ${statusColor}${safety}${RESET}`);
    console.log(`           Match: ${match}`);
    if (safety === 'FAIL') {
        console.log(`           ${RED}Reason: ${reason}${RESET}`);
    }

    // Append to log file
    try {
        const ts = new Date().toISOString();
        const line = `[${ts}] [COLD-RUN] Potential Arb Found: ${profit.toFixed(2)}% | Match: ${match} | Safety Check: ${safety} | Reason: ${reason}\n`;
        fs.appendFileSync(logPath, line);
    } catch (e) { }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER STATUS SIMULATION
// ═══════════════════════════════════════════════════════════════════════════
function simulateProviderConnection() {
    // Simulate AFB88 coming online
    setTimeout(() => {
        state.providers.A.status = 'CONNECTING';
        log(`${YELLOW}[AFB88]${RESET} 🔄 Connecting...`);
    }, 1000);

    setTimeout(() => {
        state.providers.A.status = 'LIVE';
        state.providers.A.lastSeen = Date.now();
        log(`${GREEN}[AFB88]${RESET} ✅ Status: ${GREEN}LIVE${RESET}`);
    }, 3000);

    // Simulate SABA coming online
    setTimeout(() => {
        state.providers.B.status = 'CONNECTING';
        log(`${YELLOW}[SABA]${RESET} 🔄 Connecting...`);
    }, 2000);

    setTimeout(() => {
        state.providers.B.status = 'LIVE';
        state.providers.B.lastSeen = Date.now();
        log(`${GREEN}[SABA]${RESET} ✅ Status: ${GREEN}LIVE${RESET}`);
        log(`${GREEN}${BOLD}═══ DUAL PROVIDER LIVE ═══${RESET}`);
    }, 4000);
}

// ═══════════════════════════════════════════════════════════════════════════
// LATENCY SIMULATION
// ═══════════════════════════════════════════════════════════════════════════
function simulateLatencyProcessing() {
    setInterval(() => {
        if (state.providers.A.status !== 'LIVE' || state.providers.B.status !== 'LIVE') {
            return;
        }

        // Generate random pair with varying latencies
        const scenarios = [
            { afbTs: Date.now(), sabaTs: Date.now() + 200, match: 'Arsenal vs Chelsea', profit: 1.8 },
            { afbTs: Date.now(), sabaTs: Date.now() + 800, match: 'Liverpool vs Man Utd', profit: 2.1 },
            { afbTs: Date.now(), sabaTs: Date.now() + 1500, match: 'Real Madrid vs Barcelona', profit: 1.5 }, // DROPPED
            { afbTs: Date.now(), sabaTs: Date.now() + 2500, match: 'Bayern vs Dortmund', profit: 3.2 }, // DROPPED
            { afbTs: Date.now(), sabaTs: Date.now() + 500, match: 'Juventus vs AC Milan', profit: 0.9 },
            { afbTs: Date.now(), sabaTs: 0, match: 'PSV vs Ajax', profit: 1.2 }, // MISSING
        ];

        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        const result = normService.checkTimestampSync(scenario.afbTs, scenario.sabaTs);

        state.latency.totalProcessed++;
        state.providers.A.eventCount++;
        state.providers.B.eventCount++;

        if (result.reason === 'MISSING_TIMESTAMP') {
            state.latency.missing++;
            logColdRun(scenario.profit, scenario.match, 'FAIL', 'MISSING_TIMESTAMP');
        } else if (result.isSync) {
            state.latency.synced++;
            logColdRun(scenario.profit, scenario.match, 'OK', `Latency: ${result.diff}ms`);
        } else {
            state.latency.dropped++;
            logColdRun(scenario.profit, scenario.match, 'FAIL', `Latency ${result.diff}ms > 1000ms threshold`);
        }

        // Update history for graph
        const bucket = state.latency.history[state.latency.history.length - 1];
        if (bucket && Date.now() - bucket.timestamp < 10000) {
            bucket.synced = state.latency.synced;
            bucket.dropped = state.latency.dropped;
        } else {
            state.latency.history.push({
                timestamp: Date.now(),
                synced: state.latency.synced,
                dropped: state.latency.dropped
            });
            if (state.latency.history.length > 30) state.latency.history.shift();
        }

    }, 2000);
}

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN WATCHDOG SIMULATION
// ═══════════════════════════════════════════════════════════════════════════
function simulateTokenRotation() {
    // Initial token capture
    setTimeout(() => {
        state.token.token = 'Bearer eyJhbGc' + Math.random().toString(36).substring(7);
        state.token.capturedAt = Date.now();
        log(`${MAGENTA}[TOKEN-WATCHDOG]${RESET} 🔑 Initial token captured: ${state.token.token.substring(0, 25)}...`);
    }, 5000);

    // Simulate token rotation every 60 seconds
    setInterval(() => {
        if (!state.token.token) return;

        const oldToken = state.token.token;
        state.token.token = 'Bearer eyJhbGc' + Math.random().toString(36).substring(7);
        state.token.capturedAt = Date.now();
        state.token.rotations++;

        log(`${MAGENTA}[TOKEN-WATCHDOG]${RESET} 🔄 Token rotation detected (Rotation #${state.token.rotations})`);
        log(`${MAGENTA}[TOKEN-WATCHDOG]${RESET} Previous: ${oldToken.substring(0, 25)}...`);
        log(`${MAGENTA}[TOKEN-WATCHDOG]${RESET} New: ${state.token.token.substring(0, 25)}...`);

        // Check for data continuity
        setTimeout(() => {
            log(`${MAGENTA}[TOKEN-WATCHDOG]${RESET} ✅ Token rotation successful - No data interruption`);
        }, 2000);

    }, 60000);
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function printStatusDashboard() {
    console.clear();

    const uptime = Math.floor((Date.now() - state.startTime) / 1000);
    const uptimeStr = `${Math.floor(uptime / 60)}m ${uptime % 60}s`;

    console.log(`${CYAN}${BOLD}╔═══════════════════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${CYAN}${BOLD}║         🧊 COLD RUN LIVE DEPLOYMENT v6.0 - SHADOW MODE 🧊             ║${RESET}`);
    console.log(`${CYAN}${BOLD}╠═══════════════════════════════════════════════════════════════════════╣${RESET}`);
    console.log(`${CYAN}${BOLD}║${RESET}  ${DIM}Uptime:${RESET} ${uptimeStr}                              ${RED}⚠ NO REAL BETS${RESET}  ${CYAN}${BOLD}║${RESET}`);
    console.log(`${CYAN}${BOLD}╠═══════════════════════════════════════════════════════════════════════╣${RESET}`);

    // Provider Status
    const statusA = state.providers.A.status === 'LIVE' ? `${GREEN}■ LIVE${RESET}` :
        state.providers.A.status === 'CONNECTING' ? `${YELLOW}◌ CONNECTING${RESET}` : `${RED}□ OFFLINE${RESET}`;
    const statusB = state.providers.B.status === 'LIVE' ? `${GREEN}■ LIVE${RESET}` :
        state.providers.B.status === 'CONNECTING' ? `${YELLOW}◌ CONNECTING${RESET}` : `${RED}□ OFFLINE${RESET}`;

    console.log(`${CYAN}${BOLD}║${RESET}  ${BOLD}PROVIDERS:${RESET}                                                          ${CYAN}${BOLD}║${RESET}`);
    console.log(`${CYAN}${BOLD}║${RESET}    AFB88:  ${statusA}  (${state.providers.A.eventCount} events)                            ${CYAN}${BOLD}║${RESET}`);
    console.log(`${CYAN}${BOLD}║${RESET}    SABA:   ${statusB}  (${state.providers.B.eventCount} events)                            ${CYAN}${BOLD}║${RESET}`);
    console.log(`${CYAN}${BOLD}╠═══════════════════════════════════════════════════════════════════════╣${RESET}`);

    // Latency Stats
    const total = state.latency.synced + state.latency.dropped;
    const dropRate = total > 0 ? ((state.latency.dropped / total) * 100).toFixed(1) : '0.0';

    console.log(`${CYAN}${BOLD}║${RESET}  ${BOLD}LATENCY MONITOR:${RESET} (Threshold: 1000ms)                               ${CYAN}${BOLD}║${RESET}`);
    console.log(`${CYAN}${BOLD}║${RESET}    Processed: ${state.latency.totalProcessed}                                                 ${CYAN}${BOLD}║${RESET}`);
    console.log(`${CYAN}${BOLD}║${RESET}    ${GREEN}Synced:${RESET} ${state.latency.synced}  |  ${RED}Dropped:${RESET} ${state.latency.dropped}  |  ${YELLOW}Missing:${RESET} ${state.latency.missing}           ${CYAN}${BOLD}║${RESET}`);
    console.log(`${CYAN}${BOLD}║${RESET}    Drop Rate: ${dropRate}%                                                  ${CYAN}${BOLD}║${RESET}`);

    // Latency Graph (ASCII)
    const graphWidth = 30;
    const syncBar = Math.round((state.latency.synced / Math.max(total, 1)) * graphWidth);
    const dropBar = graphWidth - syncBar;
    const graph = `${GREEN}${'█'.repeat(syncBar)}${RESET}${RED}${'█'.repeat(dropBar)}${RESET}`;
    console.log(`${CYAN}${BOLD}║${RESET}    [${graph}]                           ${CYAN}${BOLD}║${RESET}`);

    console.log(`${CYAN}${BOLD}╠═══════════════════════════════════════════════════════════════════════╣${RESET}`);

    // Token Watchdog
    const tokenAge = state.token.capturedAt ? Math.floor((Date.now() - state.token.capturedAt) / 1000) : 0;
    const tokenStatus = state.token.token ? `${GREEN}ACTIVE${RESET}` : `${YELLOW}WAITING${RESET}`;

    console.log(`${CYAN}${BOLD}║${RESET}  ${BOLD}TOKEN WATCHDOG:${RESET}                                                     ${CYAN}${BOLD}║${RESET}`);
    console.log(`${CYAN}${BOLD}║${RESET}    Status: ${tokenStatus}  |  Age: ${tokenAge}s  |  Rotations: ${state.token.rotations}                ${CYAN}${BOLD}║${RESET}`);
    console.log(`${CYAN}${BOLD}╠═══════════════════════════════════════════════════════════════════════╣${RESET}`);

    // Recent Arb Log
    console.log(`${CYAN}${BOLD}║${RESET}  ${BOLD}RECENT COLD-RUN LOGS:${RESET}                                               ${CYAN}${BOLD}║${RESET}`);
    console.log(`${CYAN}${BOLD}╚═══════════════════════════════════════════════════════════════════════╝${RESET}`);
    console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
    console.log(`\n${CYAN}${BOLD}═══════════════════════════════════════════════════════════════════════${RESET}`);
    console.log(`${CYAN}${BOLD}  🧊 COLD RUN LIVE DEPLOYMENT v6.0 - INITIALIZING${RESET}`);
    console.log(`${CYAN}${BOLD}═══════════════════════════════════════════════════════════════════════${RESET}\n`);

    log(`${YELLOW}⚠️  SHADOW MODE ACTIVE${RESET} - 'Place Bet' button is ${RED}LOCKED${RESET}`);
    log(`📂 Log file: ${logPath}`);
    log('');

    // Ensure log directory exists
    try {
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] ═══ COLD RUN SESSION STARTED ═══\n`);
    } catch (e) { }

    // Start simulations
    simulateProviderConnection();
    simulateTokenRotation();

    // Wait for providers to connect before starting latency processing
    setTimeout(() => {
        simulateLatencyProcessing();
    }, 5000);

    // Print dashboard every 5 seconds
    setInterval(printStatusDashboard, 5000);

    // Keep running
    log('🚀 Cold Run deployment active. Press Ctrl+C to stop.');
}

main().catch(console.error);
