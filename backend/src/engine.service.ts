import { Injectable, Logger } from '@nestjs/common';
import { BrowserAutomationService } from './workers/browser.automation';

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
}

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);
  private accounts: Record<'A' | 'B', AccountRuntime> = {
    A: { state: 'IDLE', url: null, browserSession: null, providerMarked: false, streamActive: false },
    B: { state: 'IDLE', url: null, browserSession: null, providerMarked: false, streamActive: false }
  };

  constructor(private browser: BrowserAutomationService) {}

  async toggle(accountId: 'A' | 'B', enabled: boolean) {
    if (enabled) return this.toggleOn(accountId);
    return this.toggleOff(accountId);
  }
  private setState(accountId: 'A' | 'B', next: WorkerState) {
    const acc = this.accounts[accountId];
    const prev = acc.state;
    acc.state = next;
    this.logger.log(`[STATE] ${accountId}: ${prev} -> ${next}`);
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
      streamActive: false
    };

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
    if (acc.state === 'BROWSER_READY') {
      acc.providerMarked = true;
      this.setState(accountId, 'PROVIDER_READY');
      this.logger.log(`[FLOW] providerMarked for ${accountId}`);
    }
  }

  streamDetected(accountId: 'A' | 'B') {
    const acc = this.accounts[accountId];
    if (acc.state === 'PROVIDER_READY') {
      acc.streamActive = true;
      this.setState(accountId, 'RUNNING');
      this.logger.log(`[FLOW] streamDetected for ${accountId}`);
    }
  }

  getState() {
    return this.accounts;
  }
}
