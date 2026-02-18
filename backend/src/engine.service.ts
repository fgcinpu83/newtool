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

  async toggleOn(accountId: 'A' | 'B') {
    const acc = this.accounts[accountId];

    console.log('[ENGINE] toggleOn called for', accountId);
    this.logger.log(`toggleOn called for ${accountId}, current state=${acc.state}, url=${acc.url}`);

    if (acc.state !== 'IDLE') return;

    if (!acc.url) throw new Error('URL_NOT_SET');


    acc.state = 'BROWSER_OPENING';

    console.log('[ENGINE] calling openBrowser for', accountId, acc.url);
    const session = await this.browser.openBrowser(accountId, acc.url);

    this.logger.log(`openBrowser returned for ${accountId}: ${session ? 'OK' : 'NULL'}`);

    if (!session) {
      acc.state = 'IDLE';
      return;
    }

    acc.browserSession = session;
    acc.state = 'BROWSER_READY';
  }

  async toggleOff(accountId: 'A' | 'B') {
    const acc = this.accounts[accountId];

    if (acc.state === 'IDLE') return;

    acc.state = 'STOPPING';

    if (acc.browserSession) {
      await this.browser.closeBrowser(accountId);
    }

    this.accounts[accountId] = {
      state: 'IDLE',
      url: null,
      browserSession: null,
      providerMarked: false,
      streamActive: false
    };
  }

  setUrl(accountId: 'A' | 'B', url: string) {
    this.accounts[accountId].url = url;
  }

  providerMarked(accountId: 'A' | 'B') {
    const acc = this.accounts[accountId];
    if (acc.state === 'BROWSER_READY') {
      acc.providerMarked = true;
      acc.state = 'PROVIDER_READY';
    }
  }

  streamDetected(accountId: 'A' | 'B') {
    const acc = this.accounts[accountId];
    if (acc.state === 'PROVIDER_READY') {
      acc.streamActive = true;
      acc.state = 'RUNNING';
    }
  }

  getState() {
    return this.accounts;
  }
}
