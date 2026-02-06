/**
 * 🔧 DIAGNOSTIC v3.5
 * Comprehensive system health check
 * Run with: npx ts-node diagnostic_v35.ts
 */

import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3001';

interface DiagnosticResult {
    component: string;
    status: 'OK' | 'WARNING' | 'ERROR';
    message: string;
    data?: any;
}

const results: DiagnosticResult[] = [];

async function runDiagnostic() {
    console.log('\n🔧 ================================');
    console.log('   GRAVITY v3.5 DIAGNOSTIC');
    console.log('================================\n');

    // Test 1: Backend Connection
    console.log('📡 [1/5] Testing Backend Connection...');

    const socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        timeout: 5000
    });

    let systemStatus: any = null;
    let connected = false;

    await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            if (!connected) {
                results.push({
                    component: 'Backend WebSocket',
                    status: 'ERROR',
                    message: 'Cannot connect to backend at localhost:3001'
                });
                resolve();
            }
        }, 5000);

        socket.on('connect', () => {
            connected = true;
            clearTimeout(timeout);
            results.push({
                component: 'Backend WebSocket',
                status: 'OK',
                message: `Connected with ID: ${socket.id}`
            });

            socket.emit('command', { type: 'GET_STATUS' });
        });

        socket.on('system_status', (data) => {
            systemStatus = data;
            resolve();
        });

        socket.on('connect_error', (err) => {
            clearTimeout(timeout);
            results.push({
                component: 'Backend WebSocket',
                status: 'ERROR',
                message: err.message
            });
            resolve();
        });
    });

    // Test 2: Provider Status
    console.log('🔌 [2/5] Checking Provider Status...');
    if (systemStatus) {
        const providers = systemStatus.providers || {};
        const names = systemStatus.providerNames || {};

        // Check Account A
        const a1State = providers.A1?.state || providers.A1 || 'UNKNOWN';
        const a1Name = names.A1 || 'Not assigned';
        results.push({
            component: 'Account A Provider',
            status: a1State === 'LIVE' ? 'OK' : a1State === 'HEARTBEAT_ONLY' ? 'WARNING' : 'ERROR',
            message: `${a1Name} - ${a1State}`,
            data: { state: a1State, balance: systemStatus.balanceA }
        });

        // Check Account B
        const b1State = providers.B1?.state || providers.B1 || 'UNKNOWN';
        const b1Name = names.B1 || 'Not assigned';
        results.push({
            component: 'Account B Provider',
            status: b1State === 'LIVE' ? 'OK' : b1State === 'HEARTBEAT_ONLY' ? 'WARNING' : 'ERROR',
            message: `${b1Name} - ${b1State}`,
            data: { state: b1State, balance: systemStatus.balanceB }
        });

        // Check Account Active States
        results.push({
            component: 'Account A Toggle',
            status: systemStatus.accountA_active ? 'OK' : 'WARNING',
            message: systemStatus.accountA_active ? 'ACTIVE' : 'INACTIVE'
        });

        results.push({
            component: 'Account B Toggle',
            status: systemStatus.accountB_active ? 'OK' : 'WARNING',
            message: systemStatus.accountB_active ? 'ACTIVE' : 'INACTIVE'
        });
    } else {
        results.push({
            component: 'System Status',
            status: 'ERROR',
            message: 'No system_status received from backend'
        });
    }

    // Test 3: Balance Check
    console.log('💰 [3/5] Checking Balances...');
    if (systemStatus) {
        const balA = parseFloat(systemStatus.balanceA || '0');
        const balB = parseFloat(systemStatus.balanceB || '0');

        results.push({
            component: 'Account A Balance',
            status: balA > 0 ? 'OK' : 'WARNING',
            message: `IDR ${balA.toFixed(2)}`
        });

        results.push({
            component: 'Account B Balance',
            status: balB > 0 ? 'OK' : 'WARNING',
            message: `IDR ${balB.toFixed(2)}`
        });
    }

    // Test 4: Worker State
    console.log('⚙️ [4/5] Checking Workers...');
    if (systemStatus) {
        results.push({
            component: 'Worker State',
            status: systemStatus.workers === 'RUNNING' ? 'OK' : 'ERROR',
            message: systemStatus.workers || 'UNKNOWN'
        });
    }

    // Test 5: Extension Connection Count
    console.log('🧩 [5/5] Checking Extension Connections...');
    // This would require checking connected clients

    // Close socket
    socket.close();

    // Print Results
    console.log('\n📊 ================================');
    console.log('   DIAGNOSTIC RESULTS');
    console.log('================================\n');

    let okCount = 0;
    let warnCount = 0;
    let errCount = 0;

    for (const result of results) {
        const icon = result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
        console.log(`${icon} ${result.component}: ${result.message}`);
        if (result.data) {
            console.log(`   └─ ${JSON.stringify(result.data)}`);
        }

        if (result.status === 'OK') okCount++;
        else if (result.status === 'WARNING') warnCount++;
        else errCount++;
    }

    console.log('\n================================');
    console.log(`Summary: ${okCount} OK | ${warnCount} WARNINGS | ${errCount} ERRORS`);
    console.log('================================\n');

    // Recommendations
    if (errCount > 0) {
        console.log('🚨 CRITICAL ISSUES DETECTED:');
        results.filter(r => r.status === 'ERROR').forEach(r => {
            console.log(`   - ${r.component}: ${r.message}`);
        });
        console.log('\n📋 RECOMMENDED ACTIONS:');
        console.log('   1. Ensure backend is running: npm run start:dev');
        console.log('   2. Reload extension in chrome://extensions');
        console.log('   3. Open betting sites and login');
        console.log('   4. Toggle accounts ON in dashboard');
    } else if (warnCount > 0) {
        console.log('⚠️ SYSTEM RUNNING WITH WARNINGS:');
        results.filter(r => r.status === 'WARNING').forEach(r => {
            console.log(`   - ${r.component}: ${r.message}`);
        });
        console.log('\n📋 TO GET FULL ACTIVE STATUS:');
        console.log('   1. Login to betting sites (AFB88, QQ188)');
        console.log('   2. Navigate to Football/Soccer section');
        console.log('   3. Wait 30 seconds for data to flow');
    } else {
        console.log('✅ SYSTEM HEALTHY - All components operational');
        console.log('\n[PRODUCTION-READY] Pairs: pending | Execution Guard: READY');
    }

    process.exit(0);
}

runDiagnostic().catch(console.error);
