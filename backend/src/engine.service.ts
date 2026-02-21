import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { WorkerService } from './workers/worker.service';
import type { AccountRuntime } from './workers/worker.service';

@Injectable()
export class EngineService {
  constructor(
    @Inject(forwardRef(() => WorkerService))
    private readonly worker: WorkerService,
  ) {}

  setPing(accountId: 'A' | 'B', ping: number) {
    this.worker.setPing(accountId, ping);
  }

  getState() {
    return this.worker.getState();
  }

  handleStreamDetected(accountId: 'A' | 'B') {
    const account = this.worker.getAccount(accountId);
    if (account.state === 'WAIT_PROVIDER') {
      this.worker.transition(accountId, 'ACTIVE');
    }
  }
}
