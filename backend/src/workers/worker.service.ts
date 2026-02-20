import { Injectable, Logger } from '@nestjs/common';

export type ProviderState = any;

export type FSMState = 'IDLE' | 'STARTING' | 'WAIT_PROVIDER' | 'ACTIVE' | 'STOPPING';

export interface AccountRuntime {
  state: FSMState;
  accountId: 'A' | 'B';
  url: string | null;
  browserSession: any | null;
  providerMarked: boolean;
  streamActive: boolean;
  providerTargetId?: string | null;
  lastStreamTs?: number | null;
  streamRate?: number | null;
  ping?: number | null;
}

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

  // Single source of truth for account runtime (per Master Context v4.0)
  public accounts: Record<'A' | 'B', AccountRuntime> = {
    A: { accountId: 'A', state: 'IDLE', url: null, browserSession: null, providerMarked: false, streamActive: false, providerTargetId: null, lastStreamTs: null, streamRate: null, ping: null },
    B: { accountId: 'B', state: 'IDLE', url: null, browserSession: null, providerMarked: false, streamActive: false, providerTargetId: null, lastStreamTs: null, streamRate: null, ping: null }
  };

  // Allowed FSM transitions for AccountRuntime (Master Context v4.0)
  private readonly ALLOWED_TRANSITIONS: Record<FSMState, FSMState[]> = {
    IDLE: ['STARTING'],
    STARTING: ['WAIT_PROVIDER'],
    WAIT_PROVIDER: ['ACTIVE', 'STOPPING'],
    ACTIVE: ['STOPPING'],
    STOPPING: ['IDLE'],
  };

  ping() { return 'pong'; }

  // Read-only sanitized snapshot suitable for API / UI
  getState() {
    const out: any = { A: {}, B: {} };
    for (const k of ['A', 'B'] as Array<'A' | 'B'>) {
      const s = this.accounts[k];
      out[k] = {
        state: s.state,
        url: s.url,
        browserSession: s.browserSession ? { port: s.browserSession.port, targetId: s.browserSession.targetId, url: s.browserSession.url } : null,
        providerMarked: s.providerMarked,
        streamActive: s.streamActive,
        providerTargetId: s.providerTargetId || null,
        lastStreamTs: s.lastStreamTs || null,
        streamRate: s.streamRate || null,
        ping: s.ping != null ? s.ping : null
      };
    }
    return out as any;
  }

  /**
   * Central FSM transition API — ALL runtime state changes MUST go through here.
   * Throws on illegal/unauthorised transitions.
   */
  transition(accountId: 'A' | 'B', to: FSMState) {
    const info = this.accounts[accountId];
    if (!info) throw new Error(`Unknown account: ${accountId}`);
    const from = info.state;
    if (from === to) return; // noop

    if (!this.ALLOWED_TRANSITIONS[from].includes(to)) {
      const msg = `Illegal FSM transition ${from} → ${to} for account ${accountId}`;
      this.logger.error(msg);
      // Emit structured system_log for visibility
      try { const p = require('path'); const fs = require('fs'); fs.appendFileSync(p.join(process.cwd(),'logs','wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'FSM_ILLEGAL_TRANSITION', accountId, from, to, message: msg }) + '\n'); } catch(e){}
      throw new Error(msg);
    }

    // Preconditions for specific transitions
    if (to === 'WAIT_PROVIDER' && !info.browserSession) {
      const msg = `Cannot transition to WAIT_PROVIDER without browserSession for ${accountId}`;
      this.logger.error(msg);
      throw new Error(msg);
    }
    if (to === 'ACTIVE' && !info.providerMarked) {
      const msg = `Cannot transition to ACTIVE without providerMarked for ${accountId}`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    // Apply transition
    this.accounts[accountId] = { ...info, state: to };
    this.logger.log(`[FSM] ${accountId} ${from} → ${to}`);
  }

  // Debug/utility: replace entire accounts state (used by debug controllers only)
  replaceState(state: any) {
    const IS_CI = process.env.CI === 'true';
    const IS_TEST = process.env.NODE_ENV === 'test';
    if (!IS_CI && !IS_TEST) {
      throw new Error('replaceState() is allowed only in CI or test environments');
    }

    try {
      if (state && state.A && state.B) {
        this.accounts.A = { ...this.accounts.A, ...state.A };
        this.accounts.B = { ...this.accounts.B, ...state.B };
        this.logger.log('WorkerService.replaceState invoked (debug)');
      }
    } catch (e) { this.logger.error('replaceState failed', e as any); }
  }

  // Basic setters used by EngineService / Gateway
  setUrl(accountId: 'A' | 'B', url: string) { this.accounts[accountId].url = url; }
  setPing(accountId: 'A' | 'B', ms: number | null) { this.accounts[accountId].ping = ms; }

  /**
   * Bind a browser session to an account and reset provider/stream flags.
   * EngineService should call this instead of mutating accounts directly.
   */
  setBrowserSession(accountId: 'A' | 'B', session: any | null) {
    const acc = this.accounts[accountId];
    acc.browserSession = session;
    acc.providerTargetId = null;
    acc.providerMarked = false;
    acc.streamActive = false;
  }

  /**
   * Provider marking API — enforces single-provider-per-account contract.
   * - If account.browserSession missing → throw
   * - If already marked with a different targetId → reject
   * - Sets providerMarked + providerTargetId and transitions to WAIT_PROVIDER
   */
  markProvider(accountId: 'A' | 'B', targetId?: string | null) {    const acc = this.accounts[accountId];
    if (!acc || !acc.browserSession) {
      const msg = `providerMarked rejected for ${accountId} - no browser session`;
      this.logger.error(msg);
      throw new Error('NO_BROWSER_SESSION');
    }

    const newTarget = targetId || (acc.browserSession && acc.browserSession.targetId) || null;
    // If already marked and target differs → reject (single provider per account)
    if (acc.providerMarked && acc.providerTargetId && newTarget && acc.providerTargetId !== newTarget) {
      const msg = `Multiple provider mark attempt for ${accountId} (existing=${acc.providerTargetId} attempted=${newTarget})`;
      this.logger.error(msg);
      try { const p = require('path'); const fs = require('fs'); fs.appendFileSync(p.join(process.cwd(),'logs','wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'PROVIDER_MARK_REJECT', accountId, existing: acc.providerTargetId, attempted: newTarget }) + '\n'); } catch(e){}
      throw new Error('MULTI_PROVIDER_NOT_ALLOWED');
    }

    // Accept mark
    acc.providerTargetId = newTarget;
    acc.providerMarked = true;

    // Enforce FSM: providerMarked keeps account in WAIT_PROVIDER
    this.transition(accountId, 'WAIT_PROVIDER');

    this.logger.log(`[FLOW] providerMarked for ${accountId}, bound target=${acc.providerTargetId}`);
  }

  // Provide a small helper to reset an account runtime (hard reset)
  hardResetAccount(accountId: 'A' | 'B') {
    this.accounts[accountId] = { accountId, state: 'IDLE', url: null, browserSession: null, providerMarked: false, streamActive: false, providerTargetId: null, lastStreamTs: null, streamRate: null, ping: null };
  }

  // Placeholder provider / contract helpers kept for compatibility
  getContract(...args: any[]) { return null; }
  getAllProviderStatuses() { return []; }
}

