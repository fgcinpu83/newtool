import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

// Use better-sqlite3 for synchronous, simple DB access
let Database: any;
try {
  Database = require('better-sqlite3');
} catch (e) {
  // If the package isn't installed yet, the service will still compile but will throw at runtime.
  Database = null;
}

export type ProviderContractRow = {
  id?: number;
  accountId: 'A' | 'B';
  endpointPattern: string;
  method: string;
  requestSchema: string | null;
  responseSchema: string | null;
  createdAt?: number;
};

export type ExecutionHistoryRow = {
  id?: number;
  timestamp: number;
  match: string;
  providerA: string;
  providerB: string;
  stakeA: number;
  stakeB: number;
  profitResult: string;
};

@Injectable()
export class SqliteService {
  private readonly logger = new Logger(SqliteService.name);
  private db: any;
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), 'data', 'ag.sqlite');
    try {
      if (!fs.existsSync(path.dirname(this.dbPath))) fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      if (!Database) throw new Error('better-sqlite3 not installed');
      this.db = new Database(this.dbPath, { fileMustExist: false });
      this.migrate();
      this.logger.log(`SQLite opened: ${this.dbPath}`);
    } catch (e: any) {
      this.logger.warn('SQLite not available: ' + (e && e.message));
      this.db = null;
    }
  }

  private migrate() {
    if (!this.db) return;
    const createContract = `
      CREATE TABLE IF NOT EXISTS provider_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        accountId TEXT NOT NULL,
        endpointPattern TEXT NOT NULL,
        method TEXT NOT NULL,
        requestSchema TEXT,
        responseSchema TEXT,
        createdAt INTEGER NOT NULL
      );
    `;
    const createExec = `
      CREATE TABLE IF NOT EXISTS execution_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        match TEXT NOT NULL,
        providerA TEXT,
        providerB TEXT,
        stakeA REAL,
        stakeB REAL,
        profitResult TEXT
      );
    `;
    const createAudit = `
      CREATE TABLE IF NOT EXISTS execution_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        matchId TEXT,
        providerA TEXT,
        providerB TEXT,
        stakeA REAL,
        stakeB REAL,
        legA_status TEXT,
        legB_status TEXT,
        hedge_triggered INTEGER DEFAULT 0,
        final_status TEXT,
        error_message TEXT
      );
    `;
    this.db.exec(createContract);
    this.db.exec(createExec);
    this.db.exec(createAudit);
    // Ensure any missing columns are added (safe to run multiple times)
    try {
      this.db.exec(`ALTER TABLE execution_audit_log ADD COLUMN matchId TEXT`);
    } catch (e) {}
    try { this.db.exec(`ALTER TABLE execution_audit_log ADD COLUMN providerA TEXT`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE execution_audit_log ADD COLUMN providerB TEXT`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE execution_audit_log ADD COLUMN stakeA REAL`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE execution_audit_log ADD COLUMN stakeB REAL`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE execution_audit_log ADD COLUMN legA_status TEXT`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE execution_audit_log ADD COLUMN legB_status TEXT`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE execution_audit_log ADD COLUMN hedge_triggered INTEGER DEFAULT 0`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE execution_audit_log ADD COLUMN final_status TEXT`); } catch (e) {}
    try { this.db.exec(`ALTER TABLE execution_audit_log ADD COLUMN error_message TEXT`); } catch (e) {}

    const createHedge = `
      CREATE TABLE IF NOT EXISTS hedge_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        auditId INTEGER,
        details TEXT
      );
    `;
    this.db.exec(createHedge);
  }

  saveProviderContract(c: ProviderContractRow) {
    if (!this.db) throw new Error('SQLite not configured');
    const stmt = this.db.prepare(`INSERT INTO provider_contracts (accountId, endpointPattern, method, requestSchema, responseSchema, createdAt) VALUES (?, ?, ?, ?, ?, ?)`);
    const res = stmt.run(c.accountId, c.endpointPattern, c.method, c.requestSchema || null, c.responseSchema || null, Date.now());
    return { lastInsertRowid: res.lastInsertRowid };
  }

  getProviderContractForAccount(accountId: 'A' | 'B') {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT * FROM provider_contracts WHERE accountId = ? ORDER BY id DESC LIMIT 1`);
    return stmt.get(accountId) || null;
  }

  deleteProviderContractForAccount(accountId: 'A' | 'B') {
    if (!this.db) return null;
    const stmt = this.db.prepare(`DELETE FROM provider_contracts WHERE accountId = ?`);
    return stmt.run(accountId);
  }

  saveExecutionHistory(row: ExecutionHistoryRow) {
    if (!this.db) throw new Error('SQLite not configured');
    const stmt = this.db.prepare(`INSERT INTO execution_history (timestamp, match, providerA, providerB, stakeA, stakeB, profitResult) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    return stmt.run(row.timestamp, row.match, row.providerA, row.providerB, row.stakeA, row.stakeB, row.profitResult);
  }

  saveExecutionAudit(row: { timestamp: number; matchId?: string; providerA?: string; providerB?: string; stakeA?: number; stakeB?: number; legA_status?: string; legB_status?: string; hedge_triggered?: boolean; final_status?: string; error_message?: string }) {
    if (!this.db) throw new Error('SQLite not configured');
    const stmt = this.db.prepare(`INSERT INTO execution_audit_log (timestamp, matchId, providerA, providerB, stakeA, stakeB, legA_status, legB_status, hedge_triggered, final_status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const res = stmt.run(row.timestamp, row.matchId || null, row.providerA || null, row.providerB || null, row.stakeA || 0, row.stakeB || 0, row.legA_status || null, row.legB_status || null, row.hedge_triggered ? 1 : 0, row.final_status || null, row.error_message || null);
    return { lastInsertRowid: res.lastInsertRowid };
  }

  updateExecutionAudit(id: number, fields: Partial<{ legA_status: string; legB_status: string; hedge_triggered: boolean; final_status: string; error_message: string }>) {
    if (!this.db) throw new Error('SQLite not configured');
    const sets: string[] = [];
    const vals: any[] = [];
    if (fields.legA_status !== undefined) { sets.push('legA_status = ?'); vals.push(fields.legA_status); }
    if (fields.legB_status !== undefined) { sets.push('legB_status = ?'); vals.push(fields.legB_status); }
    if (fields.hedge_triggered !== undefined) { sets.push('hedge_triggered = ?'); vals.push(fields.hedge_triggered ? 1 : 0); }
    if (fields.final_status !== undefined) { sets.push('final_status = ?'); vals.push(fields.final_status); }
    if (fields.error_message !== undefined) { sets.push('error_message = ?'); vals.push(fields.error_message); }
    if (sets.length === 0) return null;
    const stmt = this.db.prepare(`UPDATE execution_audit_log SET ${sets.join(', ')} WHERE id = ?`);
    vals.push(id);
    return stmt.run(...vals);
  }

  saveHedgeEvent(auditId: number | null, details?: any) {
    if (!this.db) throw new Error('SQLite not configured');
    const stmt = this.db.prepare(`INSERT INTO hedge_events (timestamp, auditId, details) VALUES (?, ?, ?)`);
    return stmt.run(Date.now(), auditId, details ? JSON.stringify(details) : null);
  }

  getExecutionHistory(limit = 100) {
    if (!this.db) return [];
    const stmt = this.db.prepare(`SELECT * FROM execution_history ORDER BY id DESC LIMIT ?`);
    return stmt.all(limit);
  }
}
