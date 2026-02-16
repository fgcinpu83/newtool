#!/usr/bin/env node
// Simulate two rapid concurrent executions for same match: first runs and hedges, second must be rejected

require('ts-node').register({ transpileOnly: true });
const { SqliteService } = require('./src/shared/sqlite.service');
const { executeHedge } = require('./src/execution/hedge.service');
const lock = require('./src/execution/execution.lock');

async function firstExecution(matchId) {
  const sqlite = new SqliteService();
  lock.startExecution(matchId);
  console.log('[DOUBLE] first startExecution ->', matchId);
  const opp = { GlobalEventID: matchId, MarketType: 'DBL', Line: 'L1', SideA: { Provider: 'DA', Stake: 2 }, SideB: { Provider: 'DB', Stake: 2 } };
  const res = sqlite.saveExecutionAudit({ timestamp: Date.now(), matchId: opp.GlobalEventID, providerA: opp.SideA.Provider, providerB: opp.SideB.Provider, stakeA: opp.SideA.Stake, stakeB: opp.SideB.Stake, legA_status: 'PENDING', legB_status: 'PENDING', hedge_triggered: false, final_status: 'PENDING' });
  const auditId = res && res.lastInsertRowid;
  // Simulate A accepted, then hold the execution (to create race window), then B fails -> hedge
  sqlite.updateExecutionAudit(auditId, { legA_status: 'ACCEPTED' });
  console.log('[DOUBLE] first Leg A ACCEPTED (holding to create race window)');
  // Hold for a short period so second attempt will run while this execution is active
  await new Promise(r => setTimeout(r, 500));
  const secondResult = { Status: 'FAILED', __reason: 'SIM_FAIL' };
  await executeHedge({ opportunity: opp, firstResult: { Status: 'ACCEPTED' }, second: secondResult }, auditId);
  sqlite.updateExecutionAudit(auditId, { legB_status: secondResult.Status, hedge_triggered: true, final_status: 'HEDGED' });
  lock.endExecution(matchId);
  console.log('[DOUBLE] first endExecution ->', matchId);
}

async function secondExecutionAttempt(matchId) {
  const sqlite = new SqliteService();
  // Emulate engine entry: check isExecuting
  if (lock.isExecuting(matchId)) {
    console.log('[DOUBLE] second attempt rejected: already executing ->', matchId);
    return { rejected: true };
  }
  // If not executing (would be unexpected here), create audit (we don't expect this path in test)
  lock.startExecution(matchId);
  const res = sqlite.saveExecutionAudit({ timestamp: Date.now(), matchId, providerA: 'DA', providerB: 'DB', stakeA: 2, stakeB: 2, legA_status: 'PENDING', legB_status: 'PENDING', hedge_triggered: false, final_status: 'PENDING' });
  const id = res && res.lastInsertRowid;
  lock.endExecution(matchId);
  return { rejected: false, auditId: id };
}

async function run() {
  try {
    const matchId = `DBL_SIM_${Date.now()}`;
    // Start both almost simultaneously
    const p1 = firstExecution(matchId);
    // small delay to simulate race
    const p2 = (async () => { await new Promise(r => setTimeout(r, 20)); return secondExecutionAttempt(matchId); })();
    const results = await Promise.all([p1, p2]);

    // Inspect DB for audits and hedges
    const db = require('better-sqlite3')(require('path').join(process.cwd(), 'data', 'ag.sqlite'));
    const audits = db.prepare('SELECT * FROM execution_audit_log WHERE matchId = ?').all(matchId);
    const hedges = db.prepare('SELECT * FROM hedge_events WHERE details LIKE ?').all('%"GlobalEventID":"' + matchId + '"%');
    console.log('[DOUBLE] audits count:', audits.length, 'audits:', audits);
    console.log('[DOUBLE] hedges count:', hedges.length, 'hedges:', hedges);
    console.log('[DOUBLE] second attempt result:', results[1]);

    process.exit(0);
  } catch (e) {
    console.error('[DOUBLE] Error:', e && e.message ? e.message : e);
    process.exit(2);
  }
}

run();
