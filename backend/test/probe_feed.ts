
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
    transports: ['websocket'],
    forceNew: true
});

console.log('🕵️ PROBE STARTED. Connecting to Backend...');

const stats = {
    afb_odds: 0,
    afb_match: 0,
    afb_session: 0,
    guardian_state_A: 'UNKNOWN'
};

socket.on('connect', () => {
    console.log('✅ Connected to Gateway.');
    socket.emit('subscribe', { channel: 'monitor' }); // Just in case
});

// MONITOR RAW DATA
socket.on('endpoint_captured', (data: any) => {
    if (data.account === 'A' || data.provider === 'AFB88') {
        if (data.type === 'odds_batch') {
            stats.afb_odds++;
            process.stdout.write('.');
        } else if (data.type === 'match_batch') {
            stats.afb_match++;
            process.stdout.write('M');
        } else if (data.type === 'session_capture') {
            stats.afb_session++;
            console.log('\n[PROBE] 🍪 SESSION CAPTURE RECEIVED');
        }
    }
});

// MONITOR GUARDIAN
socket.on('guardian:status', (data: any) => {
    // Format: key "A:AFB88" -> { state: 'LIVE', ... }
    const entry = data['A:AFB88'];
    if (entry) {
        if (entry.state !== stats.guardian_state_A) {
            console.log(`\n[PROBE] 🛡️ GUARDIAN STATE CHANGE: ${stats.guardian_state_A} -> ${entry.state}`);
            stats.guardian_state_A = entry.state;
        }
    }
});

socket.on('disconnect', () => console.log('❌ Disconnected'));

// STOP AFTER 15s
setTimeout(() => {
    console.log('\n\n🔎 PROBE RESULT:');
    console.log(`- AFB Odds Packets: ${stats.afb_odds}`);
    console.log(`- AFB Match Packets: ${stats.afb_match}`);
    console.log(`- AFB Session Events: ${stats.afb_session}`);
    console.log(`- Final Guardian State: ${stats.guardian_state_A}`);

    if (stats.afb_odds > 0 && stats.guardian_state_A === 'LIVE') {
        console.log('✅ CONCLUSION: DATA IS FLOWING CORRECTLY.');
        process.exit(0);
    } else if (stats.afb_session > 0 && stats.afb_odds === 0) {
        console.log('⚠️ CONCLUSION: Session received but NO ODDS fetched. (Worker Config/Login issue?)');
        process.exit(0);
    } else {
        console.log('❌ CONCLUSION: NO DATA DETECTED.');
        process.exit(0);
    }
}, 15000);
