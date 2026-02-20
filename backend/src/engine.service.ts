import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BrowserAutomationService } from './workers/browser.automation';
import { ChromeConnectionManager } from './managers/chrome-connection.manager';
import { WorkerService, AccountRuntime, FSMState } from './workers/worker.service';

/**
 * EngineService — lightweight orchestrator that delegates runtime state to WorkerService.
 * Conforms to Master Context v4.0 FSM: IDLE → STARTING → WAIT_PROVIDER → ACTIVE → STOPPING
 */

@Injectable()
export class EngineService implements OnModuleInit {
  private readonly logger = new Logger(EngineService.name);

  private readonly STREAM_RATE_THRESHOLD: number = Number(process.env.STREAM_RATE_THRESHOLD || 10);
  private readonly STREAM_INACTIVITY_MS: number = Number(process.env.STREAM_INACTIVITY_MS || 5000);

  constructor(private browser: BrowserAutomationService, private moduleRef: ModuleRef, private chromeManager: ChromeConnectionManager, private worker: WorkerService) {}

  onModuleInit() {
    // Wire gateway trafficBus if available to receive stream payloads
    try {
      const gw = this.moduleRef.get('AppGateway' as any, { strict: false });
      if (gw && gw.trafficBus && typeof gw.trafficBus.on === 'function') {
        gw.trafficBus.on('stream_data', (payload: any) => {
          try { this.streamDetected(payload?.account === 'B' ? 'B' : 'A', payload); } catch (e) { this.logger.error('stream_data handler failed', e as any); }
        });
      }
    } catch (e) { /* optional */ }

    // After wiring, attempt startup reconciliation to ensure Engine state matches real Chrome state
    try {
      // Fire-and-forget but log failures
      (async () => {
        try {
          await this.reconcileStartup();
        } catch (e) {
          this.logger.error('Startup reconciliation failed', e as any);
        }
      })();
    } catch (e) { /* ignore */ }
  }

  /**
   * On startup, reconcile Engine state with real Chrome tabs.
   * - Query Chrome /json list
   * - Attempt to re-bind tabs to accounts if they match stored URL/title
   * - Close orphan tabs when both accounts are IDLE
   */
  private async reconcileStartup() {
    try {
      const port = 9222;
      const info = await this.chromeManager.attach(port);
      if (info.state !== 'CONNECTED') {
        this.logger.log('[RECONCILE] Chrome not connected - skipping reconciliation');
        return;
      }

      const tabs = await this.chromeManager.getTabs(port);
      if (!tabs || tabs.length === 0) return;

      // Track which tab ids we've bound to accounts
      const bound = new Set<string>();

      // Try to bind tabs to accounts based on stored url patterns or title
      for (const acct of ['A', 'B'] as Array<'A' | 'B'>) {
        const acc = this.worker.accounts[acct];
        if (acc.browserSession) {
          if (acc.browserSession.targetId) bound.add(String(acc.browserSession.targetId));
          continue;
        }

        if (!acc.url) continue; // nothing to match against

        const match = tabs.find(t => {
          try {
            return (t.url && acc.url && t.url.includes(acc.url)) || (t.title && acc.url && t.title.includes(acc.url));
          } catch { return false; }
        });

            if (match) {
          // Re-bind this tab to the account (delegate mutation to WorkerService)
          this.worker.setBrowserSession(acct, { port, targetId: String(match.id), url: match.url });
          // On startup we consider re-bound sessions as WAIT_PROVIDER (provider must be explicitly marked)
          this.setState(acct, 'WAIT_PROVIDER');
          bound.add(String(match.id));
          this.logger.log(`[RECONCILE] Re-bound tab ${match.id} to account ${acct}`);
        }
      }

      // If there are remaining tabs and both accounts are IDLE, close orphan tabs
      const remaining = tabs.filter(t => !bound.has(String(t.id)));
      const bothIdle = this.worker.accounts.A.state === 'IDLE' && this.worker.accounts.B.state === 'IDLE';
      if (remaining.length > 0 && bothIdle) {
        for (const t of remaining) {
          try {
            await this.chromeManager.closeTab(port, String(t.id));
            this.logger.log(`[RECONCILE] Closing orphan tab ${t.id}`);
          } catch (e) {
            this.logger.error(`[RECONCILE] Failed to close orphan tab ${t.id}`, e as any);
          }
        }
      }
    } catch (e) {
      this.logger.error('Reconciliation routine error', e as any);
    }
  }

  async toggle(accountId: 'A' | 'B', enabled: boolean) {
    if (enabled) return this.toggleOn(accountId);
    return this.toggleOff(accountId);
  }

  // Centralised state setter — delegate actual mutation to WorkerService.transition()
  private setState(accountId: 'A' | 'B', next: FSMState) {
    const prev = this.worker.accounts[accountId].state;
    this.worker.transition(accountId, next);
    this.logger.log(`[STATE] ${accountId}: ${prev} -> ${next}`);
    // FSM invariant checks (worker.transition already enforces preconditions)
    try { this.assertInvariants(accountId); } catch (e) { this.logger.error('Invariant assertion failed', e as any); }
  }

  async toggleOn(accountId: 'A' | 'B') {
    const acc = this.worker.accounts[accountId];

    this.logger.log(`[FLOW] Toggle ON requested for ${accountId}`);
    this.logger.log(`toggleOn called for ${accountId}, current state=${acc.state}, url=${acc.url}`);

    if (acc.state !== 'IDLE') {
      this.logger.log(`[FLOW] Toggle ON aborted for ${accountId} - not IDLE (state=${acc.state})`);
      throw new Error('INVALID_STATE');
    }

    if (!acc.url) {
      this.logger.log(`[FLOW] Toggle ON failed for ${accountId} - URL_NOT_SET`);
      throw new Error('URL_NOT_SET');
    }

    // Per constitution: Toggle ON -> STARTING -> openBrowser() -> WAIT_PROVIDER
    this.setState(accountId, 'STARTING');

    this.logger.log(`[FLOW] calling openBrowser for ${accountId} ${acc.url}`);
    const session = await this.browser.openBrowser(accountId, acc.url);
    this.logger.log(`[FLOW] openBrowser result for ${accountId}: ${session ? 'OK' : 'NULL'}`);

    if (!session) {
      this.logger.log(`[FLOW] openBrowser failed for ${accountId}`);
      // revert state
      this.setState(accountId, 'IDLE');
      throw new Error('OPEN_BROWSER_FAILED');
    }

    // Delegate storing session + reset of provider/stream flags to WorkerService
    this.worker.setBrowserSession(accountId, session);
    const stored = this.worker.accounts[accountId].browserSession;
    if (!stored) {
      this.logger.log(`[FLOW] Browser session missing after open for ${accountId}`);
      this.setState(accountId, 'IDLE');
      throw new Error('BROWSER_SESSION_MISSING');
    }

    // After successful open, move to WAIT_PROVIDER and wait for explicit PROVIDER_MARKED
    this.setState(accountId, 'WAIT_PROVIDER');
    this.logger.log(`[FLOW] Browser opened successfully for ${accountId} — waiting provider mark`);

    return true;
  }

  async toggleOff(accountId: 'A' | 'B') {
    const acc = this.worker.accounts[accountId];

    this.logger.log(`[FLOW] Toggle OFF requested for ${accountId}, current state=${acc.state}`);

    if (acc.state === 'IDLE') {
      this.logger.log(`[FLOW] Toggle OFF ignored for ${accountId} - already IDLE`);
      return true;
    }

    this.setState(accountId, 'STOPPING');

    if (acc.browserSession) {
      try {
        await this.browser.closeBrowser(accountId);
        this.logger.log(`[FLOW] closeBrowser called for ${accountId}`);
      } catch (err: any) {
        this.logger.error(`[FLOW] closeBrowser error for ${accountId}: ${err && err.message ? err.message : err}`);
      }
    }

    // Hard reset via WorkerService (must clear all runtime fields)
    this.worker.hardResetAccount(accountId);

    // validate hard reset
    const after = this.worker.accounts[accountId];
    if (after.state !== 'IDLE' || after.browserSession !== null || after.providerMarked !== false || after.streamActive !== false) {
      this.logger.error(`[FLOW] Toggle OFF hard reset failed for ${accountId} -> ${JSON.stringify(after)}`);
      throw new Error('TOGGLE_OFF_DIRTY');
    }

    this.logger.log(`[FLOW] Toggle OFF completed for ${accountId}`);
    return true;
  }

  setUrl(accountId: 'A' | 'B', url: string) {
    const acc = this.worker.accounts[accountId];
    const prev = acc.url;
    acc.url = url;
    this.logger.log(`[FLOW] setUrl ${accountId}: ${prev} -> ${url}`);
  }

  providerMarked(accountId: 'A' | 'B') {
    // Delegate provider marking and single-provider enforcement to WorkerService
    this.worker.markProvider(accountId);
  }

  /**
   * Accept stream payloads and validate source and rate.
   * streamPayload expected shape: { targetId?: string, rate?: number }
   */
  streamDetected(accountId: 'A' | 'B', streamPayload?: any) {
    const acc = this.worker.accounts[accountId];

    try {
      if (!acc.browserSession) {
        this.logger.debug(`[FLOW] streamDetected ignored for ${accountId} - no browser session`);
        return;
      }

      const targetId = streamPayload && (streamPayload.targetId || streamPayload.clientTargetId || streamPayload.id)
        ? String(streamPayload.targetId || streamPayload.clientTargetId || streamPayload.id)
        : undefined;
      const rate = Number(streamPayload && streamPayload.rate ? streamPayload.rate : 0) || 0;

      // Ensure provider was bound to this account
      if (acc.providerTargetId && targetId && acc.providerTargetId !== targetId) {
        this.logger.warn(`[FLOW] streamDetected targetId mismatch for ${accountId} (expected=${acc.providerTargetId} got=${targetId})`);
        return; // ignore streams not from bound tab
      }

      // Auto-bind provider if not yet bound but target matches session
      if (!acc.providerTargetId && targetId && acc.browserSession && acc.browserSession.targetId === targetId) {
        // Delegate auto-bind to WorkerService (enforces single-provider contract)
        try {
          this.worker.markProvider(accountId, targetId);
          this.logger.log(`[FLOW] auto-bound provider for ${accountId} to target=${targetId}`);
        } catch (err) {
          this.logger.warn(`[FLOW] auto-bind rejected for ${accountId}: ${err && (err as Error).message}`);
          return;
        }
      }

      if (rate < this.STREAM_RATE_THRESHOLD) {
        this.logger.debug(`[FLOW] streamDetected for ${accountId} ignored - rate ${rate} < threshold ${this.STREAM_RATE_THRESHOLD}`);
        return;
      }

      if (!acc.providerMarked) {
        this.logger.debug(`[FLOW] streamDetected for ${accountId} ignored - provider not marked yet`);
        return;
      }

      // mark active and record timestamp/rate (do NOT perform background-driven state changes)
      acc.streamActive = true;
      acc.lastStreamTs = Date.now();
      acc.streamRate = rate;

      // reset inactivity timer (clear old then create new) — only updates streamActive flag on timeout
      try { if (acc._streamTimer) { clearTimeout(acc._streamTimer); acc._streamTimer = undefined; } } catch (e) {}
      acc._streamTimer = setTimeout(() => {
        try {
          acc.streamActive = false;
          this.logger.log(`[FLOW] stream inactivity timeout for ${accountId} - streamActive set to false`);
          // Per constitution: NO background guard — do NOT change FSM state automatically on inactivity
        } catch (e) { this.logger.error('stream inactivity handler failed', e as any); }
      }, this.STREAM_INACTIVITY_MS as any);

      // Transition to ACTIVE if not already - do this after marking streamActive
      if (acc.state !== 'ACTIVE') {
        this.setState(accountId, 'ACTIVE');
      }

      this.logger.log(`[FLOW] streamDetected for ${accountId} accepted (rate=${rate})`);
    } catch (e) {
      this.logger.error('[FLOW] streamDetected failed', e as any);
    }
  }

  getSystemHealth() {
    let chromeConnected = false;
    let openTabs = 0;
    try {
      const info = this.chromeManager.getInfo(9222);
      chromeConnected = info.state === 'CONNECTED';
      openTabs = info.tabs;
    } catch (e) {
      chromeConnected = false;
    }

    const mismatch = chromeConnected && openTabs > 0 && this.worker.accounts.A.state === 'IDLE' && this.worker.accounts.B.state === 'IDLE';

    return {
      chromeConnected,
      openTabs,
      mismatch,
      accountA: this.summarize('A'),
      accountB: this.summarize('B')
    } as any;
  }

  private summarize(accountId: 'A' | 'B') {
    const a = this.worker.accounts[accountId];
    return {
      state: a.state,
      session: a.browserSession,
      streamActive: a.streamActive,
      providerTargetId: a.providerTargetId || null
    };
  }

  private assertInvariants(accountId: 'A' | 'B') {
    const a = this.worker.accounts[accountId];

    // STARTING must be transient — warn if it persists
    if (a.state === 'STARTING') {
      this.logger.warn(`INVARIANT: ${accountId} in STARTING state — should transition quickly`);
    }

    // If WAIT_PROVIDER, browserSession must exist
    if (a.state === 'WAIT_PROVIDER' && !a.browserSession) {
      this.logger.error(`INVARIANT VIOLATION: ${accountId} is WAIT_PROVIDER but browserSession is null`);
      throw new Error('INVARIANT_WAIT_PROVIDER_NO_SESSION');
    }

    // ACTIVE must have recent stream activity (streamActive flag may be false transiently but we do not auto-revert state)
    if (a.state === 'ACTIVE' && !a.streamActive) {
      const last = a.lastStreamTs || 0;
      const age = Date.now() - last;
      this.logger.log(`INVARIANT: ${accountId} ACTIVE but streamActive false — lastStream=${last} age=${age}ms`);
    }
  }

  // Return a sanitized copy of engine state suitable for JSON serialization
  getState() {
    // Delegate to WorkerService snapshot (single source of truth)
    return this.worker.getState();
  }

  // Set measured ping (ms) for an account. Accepts null to clear.
  setPing(accountId: 'A' | 'B', ms: number | null) {
    this.worker.setPing(accountId, ms);
    try { this.logger.log(`[PING] setPing ${accountId} = ${ms}`); } catch (e) {}
  }
}
