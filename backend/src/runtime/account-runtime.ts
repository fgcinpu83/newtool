import { InternalFsmService, ToggleState } from '../events/internal-fsm.service'

export class AccountRuntime {
  public readonly accountId: string
  public readonly fsm: InternalFsmService

  constructor(accountId: string, sharedFsm?: InternalFsmService) {
    this.accountId = accountId
    this.fsm = sharedFsm || new InternalFsmService()
  }

  getState(): ToggleState {
    return this.fsm.get(this.accountId)
  }

  transition(newState: ToggleState) {
    return this.fsm.transition(this.accountId, newState)
  }
}
