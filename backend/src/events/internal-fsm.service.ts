import { Injectable, Logger } from '@nestjs/common'

export enum ToggleState {
  IDLE = 'IDLE', STARTING = 'STARTING', RUNNING = 'RUNNING', STOPPING = 'STOPPING'
}

@Injectable()
export class InternalFsmService {
  private readonly logger = new Logger(InternalFsmService.name)
  private fsm: Record<string, ToggleState> = { A: ToggleState.IDLE, B: ToggleState.IDLE }

  get(account: string): ToggleState {
    return this.fsm[account]
  }

  // Only allow WorkerService (best-effort): check call stack
  transition(account: string, newState: ToggleState) {
    const stack = (new Error()).stack || ''
    if (!stack.includes('WorkerService')) {
      this.logger.error(`FSM mutation attempted by non-WorkerService caller. Blocking. Stack: ${stack.split('\n')[2] || ''}`)
      throw new Error('FSM mutation only allowed from WorkerService')
    }
    const old = this.fsm[account]
    this.fsm[account] = newState
    this.logger.log(`FSM ${account}: ${old} -> ${newState}`)
  }

  // Trusted transition bypass for controlled WorkerService use-cases
  // ONE-TIME TOKEN PROTECTED: issueToken() + trustedTransition(token)
  private tokens: Map<string, number> = new Map()

  issueToken(ttlMs = 5000): string {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const exp = Date.now() + ttlMs
    this.tokens.set(token, exp)
    // schedule cleanup lazily
    setTimeout(() => { this.tokens.delete(token) }, ttlMs + 100)
    this.logger.log(`Issued FSM token (exp in ${ttlMs}ms)`)
    return token
  }

  trustedTransition(account: string, newState: ToggleState, token?: string) {
    const now = Date.now()
    if (!token || !this.tokens.has(token)) {
      this.logger.error(`Trusted transition blocked: missing/invalid token`)
      throw new Error('Trusted transition requires a valid token')
    }
    const exp = this.tokens.get(token) || 0
    if (exp < now) {
      this.tokens.delete(token)
      this.logger.error(`Trusted transition blocked: expired token`)
      throw new Error('Trusted transition token expired')
    }
    // consume token
    this.tokens.delete(token)

    const old = this.fsm[account]
    this.fsm[account] = newState
    this.logger.log(`Trusted FSM ${account}: ${old} -> ${newState}`)
  }

  statusSnapshot() {
    return { ...this.fsm }
  }
}
