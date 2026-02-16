#!/usr/bin/env node
// Watcher: polls SQLite for new execution_audit_log and hedge_events rows
const path = require('path');
const fs = require('fs');
let Database;
try { Database = require('better-sqlite3'); } catch (e) { console.error('better-sqlite3 missing in container context'); process.exit(1); }

const dbPath = path.join(process.cwd(), 'data', 'ag.sqlite');
if (!fs.existsSync(dbPath)) { console.error('DB not found at', dbPath); process.exit(1); }
const db = new Database(dbPath, { fileMustExist: true });

let lastAuditId = 0;
let lastHedgeId = 0;

function poll() {
  try {
    const audits = db.prepare('SELECT * FROM execution_audit_log WHERE id > ? ORDER BY id ASC').all(lastAuditId);
    for (const a of audits) {
      lastAuditId = Math.max(lastAuditId, a.id);
      console.log('[WATCHER_AUDIT]', JSON.stringify(a));
    }
    const hedges = db.prepare('SELECT * FROM hedge_events WHERE id > ? ORDER BY id ASC').all(lastHedgeId);
    for (const h of hedges) {
      lastHedgeId = Math.max(lastHedgeId, h.id);
      console.log('[WATCHER_HEDGE]', JSON.stringify(h));
    }
  } catch (e) {
    console.error('[WATCHER] poll error', e && e.message ? e.message : e);
  }
}

console.log('[WATCHER] starting, watching', dbPath);
// initialize last ids
try {
  const r1 = db.prepare('SELECT MAX(id) as id FROM execution_audit_log').get();
  const r2 = db.prepare('SELECT MAX(id) as id FROM hedge_events').get();
  lastAuditId = (r1 && r1.id) || 0;
  lastHedgeId = (r2 && r2.id) || 0;
} catch (e) {}

setInterval(poll, 1000);
