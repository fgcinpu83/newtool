import { AccountRuntime } from './account-runtime'
import { InternalFsmService } from '../events/internal-fsm.service'

export class AccountRuntimeManager {
  private runtimes = new Map<string, AccountRuntime>()
  private sharedFsm?: InternalFsmService

  constructor(sharedFsm?: InternalFsmService) {
    this.sharedFsm = sharedFsm
  }

  get(accountId: string): AccountRuntime {
    if (!this.runtimes.has(accountId)) {
      this.runtimes.set(accountId, new AccountRuntime(accountId, this.sharedFsm))
    }
    return this.runtimes.get(accountId)!
  }

  getAll(): AccountRuntime[] {
    return Array.from(this.runtimes.values())
  }
}
