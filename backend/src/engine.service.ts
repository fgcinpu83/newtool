import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { WorkerService } from './workers/worker.service';
import type { AccountRuntime } from './workers/worker.service';
import { BrowserAutomationService } from './workers/browser.automation';

// mirrored from worker.service.ts; kept locally to avoid circular imports
type FSMState = 'IDLE' | 'STARTING' | 'WAIT_PROVIDER' | 'ACTIVE' | 'STOPPING';

@Injectable()
export class EngineService {
  constructor(
    @Inject(forwardRef(() => WorkerService))
    private readonly worker: WorkerService,
    // injection for browser control
    private readonly browser: BrowserAutomationService,
  ) {}

  // ----- public API used by controllers/ws handlers -----
  setUrl(accountId: 'A' | 'B', url: string) {
    this.worker.setUrl(accountId, url);
  }

  setPing(accountId: 'A' | 'B', ping: number) {
    this.worker.setPing(accountId, ping);
  }

  markProvider(accountId: 'A' | 'B', providerId: string) {
    this.worker.markProvider(accountId, providerId);
  }

  handleStreamDetected(accountId: 'A' | 'B') {
    const account = this.worker.getAccount(accountId);

    if (
      account.state === 'WAIT_PROVIDER' &&
      account.providerMarked
    ) {
      this.worker.transition(accountId, 'ACTIVE');
    }
  }


  /**
   * Return a frontend-friendly snapshot of the entire system state.
   * This shape is defined by the UI contract (see frontend_new/types.ts) and
   * must remain stable; the worker runtime is treated as an internal detail.
   */
  /**
   * Return a frontend-friendly snapshot of the entire system state.
   * This shape is defined by the UI contract (see frontend_new/types.ts) and
   * must remain stable; the worker runtime is treated as an internal detail.
   *
   * The contract is now _frontend‑driven_: the frontend specifies exactly what
   * fields it expects, and the backend merely adapts its internal runtime into
   * that format.  No further transformation is performed on the client side.
   */
  getState() {
    const runtime = this.worker.getState();

    // compute a simple global FSM state (prefer A if available)
    const globalState = this.computeGlobalState(runtime.accounts);

    return {
      // single boolean connection flag; frontend may extend with more details
      connection: true,
      fsm: { state: globalState },
      accounts: {
        A: {
          active: runtime.accounts.A.state === 'ACTIVE',
          ping: runtime.accounts.A.ping,
          providerStatus: runtime.accounts.A.providerMarked ? 'GREEN' : 'RED',
          balance: null,
        },
        B: {
          active: runtime.accounts.B.state === 'ACTIVE',
          ping: runtime.accounts.B.ping,
          providerStatus: runtime.accounts.B.providerMarked ? 'GREEN' : 'RED',
          balance: null,
        },
      },
      // the following fields remain for backwards compatibility with
      // components that haven't been refactored yet.  They will eventually be
      // removed once the UI has fully migrated to the new contract.
      gravity: { mode: 'STANDBY', activeOpportunities: 0 },
      sensors: [],
      opportunities: [],
      executionHistory: [],
      logs: [],
    };
  }

  /**
   * Derive a global FSM state from per-account runtimes.  If either account is
   * past STARTING we report that state, otherwise fall back to IDLE.
   */
  private computeGlobalState(accounts: Record<'A' | 'B', AccountRuntime>): FSMState {
    if (accounts.A.state !== 'IDLE') return accounts.A.state;
    if (accounts.B.state !== 'IDLE') return accounts.B.state;
    return 'IDLE';
  }

  // ----- workflow helpers -----
  async toggleOn(accountId: 'A' | 'B') {
    const account = this.worker.getAccount(accountId);

    if (account.state !== 'IDLE') return;

    this.worker.transition(accountId, 'STARTING');

    if (!account.url) {
      throw new Error('URL_NOT_SET');
    }

    // await browser startup; do not advance FSM until success
    try {
      const res = await this.browser.openBrowser(accountId, account.url);
      if (!res) {
        throw new Error('BROWSER_OPEN_FAILED');
      }
      this.worker.transition(accountId, 'WAIT_PROVIDER');
    } catch (e) {
      // rollback to IDLE on failure
      this.worker.transition(accountId, 'IDLE');
      // rethrow so caller (controller) can log and inform user
      throw e;
    }
  }

  async toggleOff(accountId: 'A' | 'B') {
    const account = this.worker.getAccount(accountId);

    if (account.state === 'IDLE') return;

    this.worker.transition(accountId, 'STOPPING');

    try {
      await this.browser.closeBrowser(accountId);
    } catch (e) {
      // ignore closing errors but log if necessary
      console.error('[EngineService] closeBrowser failed', e);
    }

    this.worker.hardResetAccount(accountId);
  }
}
