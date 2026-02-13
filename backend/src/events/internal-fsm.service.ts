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

  statusSnapshot() {
    return { ...this.fsm }
  }
}
