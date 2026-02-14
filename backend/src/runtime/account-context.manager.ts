import { AccountContext } from './account-context'

export class AccountContextManager {
  private contexts: Map<'A' | 'B', AccountContext> = new Map()

  constructor() {
    this.contexts.set('A', new AccountContext('A'))
    this.contexts.set('B', new AccountContext('B'))
  }

  get(account: 'A' | 'B'): AccountContext {
    return this.contexts.get(account) as AccountContext
  }

  getAll(): AccountContext[] {
    return Array.from(this.contexts.values())
  }

  reset(account: 'A' | 'B') {
    const ctx = this.get(account)
    ctx.reset()
  }
}
