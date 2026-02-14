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
    this.db.exec(createContract);
    this.db.exec(createExec);
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

  getExecutionHistory(limit = 100) {
    if (!this.db) return [];
    const stmt = this.db.prepare(`SELECT * FROM execution_history ORDER BY id DESC LIMIT ?`);
    return stmt.all(limit);
  }
}
