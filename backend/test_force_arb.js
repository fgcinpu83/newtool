#!/usr/bin/env node
// Quick internal simulation: force Leg A success, Leg B failure, trigger hedge
// Run inside project root: `node backend/test_force_arb.js`

require('ts-node').register({ transpileOnly: true });
const path = require('path');
const Database = require('better-sqlite3');

const { SqliteService } = require('./src/shared/sqlite.service');
const { executeHedge } = require('./src/execution/hedge.service');

async function run() {
  try {
    const sqlite = new SqliteService();

    const opp = {
      GlobalEventID: `SIM_MATCH_${Date.now()}`,
      MarketType: 'TEST_MARKET',
      Line: 'L1',
      SideA: { Provider: 'SIM_A', Stake: 10 },
      SideB: { Provider: 'SIM_B', Stake: 10 }
    };

    console.log('[SIM] Inserting initial audit row');
    const res = sqlite.saveExecutionAudit({ timestamp: Date.now(), matchId: opp.GlobalEventID, providerA: opp.SideA.Provider, providerB: opp.SideB.Provider, stakeA: opp.SideA.Stake, stakeB: opp.SideB.Stake, legA_status: 'PENDING', legB_status: 'PENDING', hedge_triggered: false, final_status: 'PENDING' });
    const auditId = (res && res.lastInsertRowid) || null;
    console.log('[SIM] auditId=', auditId);

    console.log('[SIM] Simulating Leg A accepted');
    const firstResult = { Status: 'ACCEPTED', Provider: 'A', BetID: 'SIM_A_' + Date.now() };
    sqlite.updateExecutionAudit(auditId, { legA_status: 'ACCEPTED' });

    console.log('[SIM] Simulating Leg B failure');
    const secondResult = { Status: 'FAILED', __reason: 'SIM_FAILURE' };

    console.log('[SIM] Triggering hedge protocol (best-effort)');
    try {
      await executeHedge({ opportunity: opp, firstResult, second: secondResult }, auditId);
    } catch (e) {
      console.error('[SIM] executeHedge threw:', e && e.message ? e.message : e);
    }

    console.log('[SIM] Updating audit row to HEDGED');
    sqlite.updateExecutionAudit(auditId, { legB_status: secondResult.Status, hedge_triggered: true, final_status: 'HEDGED', error_message: secondResult.__reason });

    // Inspect DB directly
    const dbPath = path.join(process.cwd(), 'data', 'ag.sqlite');
    const db = new Database(dbPath, { fileMustExist: true });
    const audit = db.prepare('SELECT * FROM execution_audit_log WHERE id = ?').get(auditId);
    const hedges = db.prepare('SELECT * FROM hedge_events WHERE auditId = ? ORDER BY id DESC').all(auditId);

    console.log('[SIM] Audit row:', audit);
    console.log('[SIM] Hedge events:', hedges);

    try {
      const lock = require('./src/execution/execution.lock');
      const locked = !!lock.isExecuting(opp.GlobalEventID);
      console.log('[SIM] Lock state for', opp.GlobalEventID, ':', locked ? 'LOCKED' : 'RELEASED');
    } catch (e) {
      console.warn('[SIM] Could not check lock state:', e && e.message ? e.message : e);
    }

    console.log('[SIM] Done');
    process.exit(0);
  } catch (err) {
    console.error('[SIM] Error running simulation:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

run();
