import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BrowserAutomationService } from './workers/browser.automation';
import { ChromeConnectionManager } from './managers/chrome-connection.manager';

type WorkerState =
  | 'IDLE'
  | 'BROWSER_OPENING'
  | 'BROWSER_READY'
  | 'PROVIDER_READY'
  | 'RUNNING'
  | 'STOPPING';

interface AccountRuntime {
  state: WorkerState;
  url: string | null;
  browserSession: any | null;
  providerMarked: boolean;
  streamActive: boolean;
  providerTargetId?: string | null;
  lastStreamTs?: number | null;
  streamRate?: number | null;
  _streamTimer?: any;
  ping?: number | null;
}

@Injectable()
export class EngineService implements OnModuleInit {
  private readonly logger = new Logger(EngineService.name);
  private accounts: Record<'A' | 'B', AccountRuntime> = {
    A: { state: 'IDLE', url: null, browserSession: null, providerMarked: false, streamActive: false, providerTargetId: null, lastStreamTs: null, ping: null },
    B: { state: 'IDLE', url: null, browserSession: null, providerMarked: false, streamActive: false, providerTargetId: null, lastStreamTs: null, ping: null }
  };

  private readonly STREAM_RATE_THRESHOLD: number = Number(process.env.STREAM_RATE_THRESHOLD || 10);
  private readonly STREAM_INACTIVITY_MS: number = Number(process.env.STREAM_INACTIVITY_MS || 5000);

  constructor(private browser: BrowserAutomationService, private moduleRef: ModuleRef, private chromeManager: ChromeConnectionManager) {}

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
        const acc = this.accounts[acct];
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
          // Re-bind this tab to the account
          acc.browserSession = { port, targetId: String(match.id), url: match.url } as any;
          acc.providerTargetId = null;
          acc.providerMarked = false;
          acc.streamActive = false;
          this.setState(acct, 'BROWSER_READY');
          bound.add(String(match.id));
          this.logger.log(`[RECONCILE] Re-bound tab ${match.id} to account ${acct}`);
        }
      }

      // If there are remaining tabs and both accounts are IDLE, close orphan tabs
      const remaining = tabs.filter(t => !bound.has(String(t.id)));
      const bothIdle = this.accounts.A.state === 'IDLE' && this.accounts.B.state === 'IDLE';
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
  private setState(accountId: 'A' | 'B', next: WorkerState) {
    const acc = this.accounts[accountId];
    const prev = acc.state;
    acc.state = next;
    this.logger.log(`[STATE] ${accountId}: ${prev} -> ${next}`);
    // check invariants after transitions
    try { this.assertInvariants(accountId); } catch (e) { this.logger.error('Invariant assertion failed', e as any); }
  }

  async toggleOn(accountId: 'A' | 'B') {
    const acc = this.accounts[accountId];

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

    this.setState(accountId, 'BROWSER_OPENING');

    this.logger.log(`[FLOW] calling openBrowser for ${accountId} ${acc.url}`);
    const session = await this.browser.openBrowser(accountId, acc.url);
    this.logger.log(`[FLOW] openBrowser result for ${accountId}: ${session ? 'OK' : 'NULL'}`);

    if (!session) {
      this.logger.log(`[FLOW] openBrowser failed for ${accountId}`);
      // revert state
      this.setState(accountId, 'IDLE');
      throw new Error('OPEN_BROWSER_FAILED');
    }

    acc.browserSession = session;
    if (!acc.browserSession) {
      this.logger.log(`[FLOW] Browser session missing after open for ${accountId}`);
      this.setState(accountId, 'IDLE');
      throw new Error('BROWSER_SESSION_MISSING');
    }

    // Reset provider binding and stream state on new session
    acc.providerTargetId = null;
    acc.providerMarked = false;
    acc.streamActive = false;

    this.setState(accountId, 'BROWSER_READY');
    this.logger.log(`[FLOW] Browser opened successfully for ${accountId}`);

    return true;
  }

  async toggleOff(accountId: 'A' | 'B') {
    const acc = this.accounts[accountId];

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

    this.accounts[accountId] = {
      state: 'IDLE',
      url: null,
      browserSession: null,
      providerMarked: false,
      streamActive: false,
      providerTargetId: null,
      lastStreamTs: null
    };

    // validate hard reset
    const after = this.accounts[accountId];
    if (after.state !== 'IDLE' || after.browserSession !== null || after.providerMarked !== false || after.streamActive !== false) {
      this.logger.error(`[FLOW] Toggle OFF hard reset failed for ${accountId} -> ${JSON.stringify(after)}`);
      throw new Error('TOGGLE_OFF_DIRTY');
    }

    this.logger.log(`[FLOW] Toggle OFF completed for ${accountId}`);
    return true;
  }

  setUrl(accountId: 'A' | 'B', url: string) {
    const acc = this.accounts[accountId];
    const prev = acc.url;
    acc.url = url;
    this.logger.log(`[FLOW] setUrl ${accountId}: ${prev} -> ${url}`);
  }

  providerMarked(accountId: 'A' | 'B') {
    const acc = this.accounts[accountId];
    // Reject if no browser session exists
    if (!acc.browserSession) {
      this.logger.error(`[FLOW] providerMarked rejected for ${accountId} - no browser session`);
      throw new Error('NO_BROWSER_SESSION');
    }

    // Bind provider to the account's current tab targetId
    acc.providerTargetId = acc.browserSession.targetId || null;
    acc.providerMarked = true;
    this.setState(accountId, 'PROVIDER_READY');
    this.logger.log(`[FLOW] providerMarked for ${accountId}, bound target=${acc.providerTargetId}`);
  }

  /**
   * Accept stream payloads and validate source and rate.
   * streamPayload expected shape: { targetId?: string, rate?: number }
   */
  streamDetected(accountId: 'A' | 'B', streamPayload?: any) {
    const acc = this.accounts[accountId];

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
        acc.providerTargetId = targetId;
        acc.providerMarked = true;
        this.logger.log(`[FLOW] auto-bound provider for ${accountId} to target=${targetId}`);
      }

      if (rate < this.STREAM_RATE_THRESHOLD) {
        this.logger.debug(`[FLOW] streamDetected for ${accountId} ignored - rate ${rate} < threshold ${this.STREAM_RATE_THRESHOLD}`);
        return;
      }

      if (!acc.providerMarked) {
        this.logger.debug(`[FLOW] streamDetected for ${accountId} ignored - provider not marked yet`);
        return;
      }

      // mark active and record timestamp/rate BEFORE state transition
      acc.streamActive = true;
      acc.lastStreamTs = Date.now();
      acc.streamRate = rate;

      // reset inactivity timer (clear old then create new)
      try { if (acc._streamTimer) { clearTimeout(acc._streamTimer); acc._streamTimer = undefined; } } catch (e) {}
      acc._streamTimer = setTimeout(() => {
        try {
          acc.streamActive = false;
          this.logger.log(`[FLOW] stream inactivity timeout for ${accountId} - streamActive set to false`);
          if (acc.state === 'RUNNING') {
            this.logger.log(`[FLOW] RUNNING -> PROVIDER_READY for ${accountId} due to inactivity`);
            this.setState(accountId, 'PROVIDER_READY');
          }
        } catch (e) { this.logger.error('stream inactivity handler failed', e as any); }
      }, this.STREAM_INACTIVITY_MS as any);

      // Transition to RUNNING if not already - do this after marking streamActive
      if (acc.state !== 'RUNNING') {
        this.setState(accountId, 'RUNNING');
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

    const mismatch = chromeConnected && openTabs > 0 && this.accounts.A.state === 'IDLE' && this.accounts.B.state === 'IDLE';

    return {
      chromeConnected,
      openTabs,
      mismatch,
      accountA: this.summarize('A'),
      accountB: this.summarize('B')
    } as any;
  }

  private summarize(accountId: 'A' | 'B') {
    const a = this.accounts[accountId];
    return {
      state: a.state,
      session: a.browserSession,
      streamActive: a.streamActive,
      providerTargetId: a.providerTargetId || null
    };
  }

  private assertInvariants(accountId: 'A' | 'B') {
    const a = this.accounts[accountId];
    if (a.state === 'BROWSER_READY' && !a.browserSession) {
      this.logger.error(`INVARIANT VIOLATION: ${accountId} is BROWSER_READY but browserSession is null`);
      throw new Error('INVARIANT_BROWSER_READY_NO_SESSION');
    }

    if (a.state === 'RUNNING' && !a.streamActive) {
      // Only revert to PROVIDER_READY when there is no recent stream activity
      const last = a.lastStreamTs || 0;
      const age = Date.now() - last;
      if (!last || age > this.STREAM_INACTIVITY_MS) {
        this.logger.log(`INVARIANT: ${accountId} RUNNING but streamActive false → reverting to PROVIDER_READY`);
        this.setState(accountId, 'PROVIDER_READY');
      } else {
        this.logger.log(`INVARIANT: ${accountId} RUNNING but streamActive false — recent activity (${age}ms) exists, keeping RUNNING`);
      }
    }
  }

  // Return a sanitized copy of engine state suitable for JSON serialization
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
        streamRate: s.streamRate || null
      };
    }

    // Export top-level single-source latency fields only
    const aPing = (this.accounts.A && (this.accounts.A as any).ping != null) ? (this.accounts.A as any).ping : null;
    const bPing = (this.accounts.B && (this.accounts.B as any).ping != null) ? (this.accounts.B as any).ping : null;
    (out as any).primary_ping_ms = aPing;
    (out as any).secondary_ping_ms = bPing;

    // Log summary of ping values for debugging telemetry propagation
    try {
      this.logger.log(`[PING] getState -> primary_ping_ms=${aPing} secondary_ping_ms=${bPing}`);
    } catch (e) {}

    return out as any;
  }

  // Set measured ping (ms) for an account. Accepts null to clear.
  setPing(accountId: 'A' | 'B', ms: number | null) {
    const acc = this.accounts[accountId];
    acc.ping = ms;
    // Log update so we can trace telemetry propagation
    try {
      this.logger.log(`[PING] setPing ${accountId} = ${ms}`);
    } catch (e) {}
  }
}
