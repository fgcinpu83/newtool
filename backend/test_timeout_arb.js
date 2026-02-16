#!/usr/bin/env node
// Simulate Leg B TIMEOUT scenario: leg A accepted, leg B times out -> hedge

require('ts-node').register({ transpileOnly: true });
const { SqliteService } = require('./src/shared/sqlite.service');
const { executeHedge } = require('./src/execution/hedge.service');
const lock = require('./src/execution/execution.lock');

async function run() {
  try {
    const sqlite = new SqliteService();
    const matchId = `TIMEOUT_SIM_${Date.now()}`;

    // Simulate engine reserving execution slot
    lock.startExecution(matchId);
    console.log('[TIMEOUT] startExecution ->', matchId);

    // Persist audit before execution
    const opp = { GlobalEventID: matchId, MarketType: 'TMO', Line: 'L1', SideA: { Provider: 'TA', Stake: 5 }, SideB: { Provider: 'TB', Stake: 5 } };
    const res = sqlite.saveExecutionAudit({ timestamp: Date.now(), matchId: opp.GlobalEventID, providerA: opp.SideA.Provider, providerB: opp.SideB.Provider, stakeA: opp.SideA.Stake, stakeB: opp.SideB.Stake, legA_status: 'PENDING', legB_status: 'PENDING', hedge_triggered: false, final_status: 'PENDING' });
    const auditId = res && res.lastInsertRowid;
    console.log('[TIMEOUT] auditId=', auditId);

    // Simulate Leg A accepted
    sqlite.updateExecutionAudit(auditId, { legA_status: 'ACCEPTED' });
    console.log('[TIMEOUT] Leg A ACCEPTED');

    // Simulate Leg B timeout (treated as failure)
    const secondResult = { Status: 'FAILED', __reason: 'TIMEOUT' };
    console.log('[TIMEOUT] Leg B TIMEOUT simulated');

    // Trigger hedge
    await executeHedge({ opportunity: opp, firstResult: { Status: 'ACCEPTED' }, second: secondResult }, auditId);
    sqlite.updateExecutionAudit(auditId, { legB_status: secondResult.Status, hedge_triggered: true, final_status: 'HEDGED', error_message: secondResult.__reason });

    // Release lock
    lock.endExecution(matchId);
    console.log('[TIMEOUT] endExecution ->', matchId);

    // Print audit + hedge rows
    const db = require('better-sqlite3')(require('path').join(process.cwd(), 'data', 'ag.sqlite'));
    const audit = db.prepare('SELECT * FROM execution_audit_log WHERE id = ?').get(auditId);
    const hedges = db.prepare('SELECT * FROM hedge_events WHERE auditId = ?').all(auditId);
    console.log('[TIMEOUT] Audit:', audit);
    console.log('[TIMEOUT] Hedges:', hedges);

    // Lock state check
    console.log('[TIMEOUT] Lock state:', lock.isExecuting(matchId) ? 'LOCKED' : 'RELEASED');

    process.exit(0);
  } catch (e) {
    console.error('[TIMEOUT] Error:', e && e.message ? e.message : e);
    process.exit(2);
  }
}

run();
