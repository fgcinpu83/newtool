#!/usr/bin/env node
// Simulate exposure rejection by forcing NODE_ENV=production and a tiny MAX_EXPOSURE_PER_MATCH

// Note: run this under a shell that sets env vars or set them before requiring modules.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('ts-node').register({ transpileOnly: true });
const path = require('path');
const { SqliteService } = require('./src/shared/sqlite.service');
const exposure = require('./src/execution/exposure.service');

async function run() {
  try {
    const matchId = `EXP_SIM_${Date.now()}`;
    // Try to place above a very small MAX_EXPOSURE_PER_MATCH; set via env when running container
    const amount = 10;
    const can = exposure.canPlace('A', matchId, amount);
    console.log('[EXPOSURE] canPlace A for', amount, ':', can ? 'ALLOWED' : 'REJECTED');

    const sqlite = new SqliteService();
    const row = sqlite.getExecutionHistory ? sqlite.getExecutionHistory(1) : [];

    // Confirm no audit row for matchId
    const db = require('better-sqlite3')(path.join(process.cwd(), 'data', 'ag.sqlite'));
    const audit = db.prepare('SELECT * FROM execution_audit_log WHERE matchId = ?').get(matchId);
    console.log('[EXPOSURE] audit row for', matchId, ':', audit ? 'FOUND' : 'NOT FOUND');

    process.exit(can ? 3 : 0);
  } catch (e) {
    console.error('[EXPOSURE] Error:', e && e.message ? e.message : e);
    process.exit(2);
  }
}

run();
