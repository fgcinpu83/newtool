/**
 * DIAGNOSTICS SERVICE - Pipeline Health Monitor
 * Provides detailed status of data pipeline from extension to registry
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PipelineStatus {
    timestamp: string;
    extensionConnected: boolean;
    activeTabsA: number;
    activeTabsB: number;
    lastDataA: number | null;
    lastDataB: number | null;
    registryA: number;
    registryB: number;
    bornProvidersA: string[];
    bornProvidersB: string[];
    contractA: boolean;
    contractB: boolean;
    recommendation: string;
}

export function generateDiagnosticReport(
    connCount: number,
    tabBindings: Map<string, 'A' | 'B'>,
    bornProviders: Set<string>,
    discoveryStats: { registryASize: number, registryBSize: number },
    contractRegistry: any
): PipelineStatus {

    const now = Date.now();

    // Count tabs per account
    let tabsA = 0, tabsB = 0;
    for (const [_, acc] of tabBindings) {
        if (acc === 'A') tabsA++;
        if (acc === 'B') tabsB++;
    }

    // Get born providers per account
    const bornA: string[] = [];
    const bornB: string[] = [];
    for (const key of bornProviders) {
        if (key.startsWith('A:')) bornA.push(key.replace('A:', ''));
        if (key.startsWith('B:')) bornB.push(key.replace('B:', ''));
    }

    // Check contracts
    const hasContractA = !!contractRegistry?.getContract?.('A:AFB88');
    const hasContractB = !!contractRegistry?.getContract?.('B:ISPORT');

    // Generate recommendation
    let recommendation = '';

    if (connCount === 0) {
        recommendation = '🔴 CRITICAL: No extension connected. Load the browser extension!';
    } else if (tabsA === 0 && tabsB === 0) {
        recommendation = '🟡 No browser tabs bound. Open the sports betting sites and login.';
    } else if (bornA.length === 0 && bornB.length === 0) {
        recommendation = '🟡 Providers not born. Navigate to Football/Sportsbook section.';
    } else if (!hasContractA && !hasContractB) {
        recommendation = '🟡 No API contracts captured. Interact with the betting pages.';
    } else if (discoveryStats.registryASize === 0 && discoveryStats.registryBSize === 0) {
        recommendation = '🟠 Registry empty. Scroll through match lists to trigger data capture.';
    } else if (discoveryStats.registryASize > 0 || discoveryStats.registryBSize > 0) {
        recommendation = '🟢 Data flowing! Check Live Scanner for arbitrage opportunities.';
    } else {
        recommendation = '⚪ Unknown state. Check wire_debug.log for details.';
    }

    return {
        timestamp: new Date().toISOString(),
        extensionConnected: connCount > 0,
        activeTabsA: tabsA,
        activeTabsB: tabsB,
        lastDataA: null, // Would need to track this separately
        lastDataB: null,
        registryA: discoveryStats.registryASize,
        registryB: discoveryStats.registryBSize,
        bornProvidersA: bornA,
        bornProvidersB: bornB,
        contractA: hasContractA,
        contractB: hasContractB,
        recommendation
    };
}

export function logDiagnostic(status: PipelineStatus) {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const logPath = path.join(logDir, 'diagnostic.log');
    const line = `[${status.timestamp}] Ext=${status.extensionConnected ? 'ON' : 'OFF'} TabsA=${status.activeTabsA} TabsB=${status.activeTabsB} RegA=${status.registryA} RegB=${status.registryB} Born=[${[...status.bornProvidersA, ...status.bornProvidersB].join(',')}] | ${status.recommendation}\n`;

    try {
        fs.appendFileSync(logPath, line);
    } catch (e) { }

    console.log(line.trim());
}
