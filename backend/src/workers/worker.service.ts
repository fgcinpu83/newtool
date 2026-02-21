import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EngineService } from '../engine.service';





























type AccountState =
  | 'IDLE'
  | 'STARTING'
  | 'WAIT_PROVIDER'
  | 'ACTIVE'
  | 'STOPPING';

export interface AccountRuntime {
  accountId: 'A' | 'B';
  state: AccountState;
  url: string | null;
  browserSession: unknown | null;
  providerId: string | null;
  providerMarked: boolean;
  streamActive: boolean;
  ping: number | null;
}
@Injectable()
export class WorkerService {
    // Explicit minimal setter for browserSession
    setBrowserSession(accountId: 'A' | 'B', session: unknown) {
      this.accounts[accountId].browserSession = session;
    }

    // Explicit minimal setter for providerMarked and providerId
    markProvider(accountId: 'A' | 'B', providerId: string) {
      this.accounts[accountId].providerMarked = true;
      this.accounts[accountId].providerId = providerId;
    }
  private accounts: Record<'A' | 'B', AccountRuntime> = {
    A: {
      accountId: 'A',
      state: 'IDLE',
      url: null,
      browserSession: null,
      providerId: null,
      providerMarked: false,
      streamActive: false,
      ping: null,
    },
    B: {
      accountId: 'B',
      state: 'IDLE',
      url: null,
      browserSession: null,
      providerId: null,
      providerMarked: false,
      streamActive: false,
      ping: null,
    },
  };

  constructor(
    @Inject(forwardRef(() => EngineService))
    private readonly engineService: EngineService,
  ) {}

  getState() {
    return { accounts: this.accounts };
  }

  getAccount(accountId: 'A' | 'B') {
    return this.accounts[accountId];
  }

  transition(accountId: 'A' | 'B', nextState: AccountState) {
    const current = this.accounts[accountId].state;
    this.validateTransition(current, nextState);
    this.accounts[accountId].state = nextState;
  }

  setPing(accountId: 'A' | 'B', ping: number) {
    this.accounts[accountId].ping = ping;
  }

  setUrl(accountId: 'A' | 'B', url: string) {
    this.accounts[accountId].url = url;
  }

  hardResetAccount(accountId: 'A' | 'B') {
    this.accounts[accountId] = {
      accountId,
      state: 'IDLE',
      url: null,
      browserSession: null,
      providerId: null,
      providerMarked: false,
      streamActive: false,
      ping: null,
    };
  }

  private validateTransition(current: AccountState, next: AccountState) {
    const allowed: Record<AccountState, AccountState[]> = {
      IDLE: ['STARTING'],
      STARTING: ['WAIT_PROVIDER'],
      WAIT_PROVIDER: ['ACTIVE', 'STOPPING'],
      ACTIVE: ['STOPPING'],
      STOPPING: ['IDLE'],
    };

    if (!allowed[current].includes(next)) {
      throw new Error(
        `INVALID_FSM_TRANSITION: ${current} -> ${next}`,
      );
    }
  }
}

