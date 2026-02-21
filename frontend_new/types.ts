// Frontend-defined contract.  Backend is expected to return this shape
// verbatim; the frontend code assumes it and no further transformation is
// performed.  Fields marked "optional" are emitted by the backend for
// compatibility or extra features but are not relied upon by the core UI.

export type FSMState = 'IDLE' | 'STARTING' | 'WAIT_PROVIDER' | 'ACTIVE' | 'STOPPING'

export interface FSM {
  state: FSMState
}

export interface GravityState {
  mode: string
  activeOpportunities: number
}

export interface SensorReading {
  id: string
  provider: string
  lastPacket: string
}

export interface Opportunity {
  id: string
  providerA: string
  providerB: string
  oddsA: number
  oddsB: number
  profitPercent: number
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE' | string
  // optional timestamp when opportunity was observed (ISO string or numeric ms)
  timestamp?: string | number
  description?: string
}

export interface ExecutionRecord {
  id: string
  pair: string
  stakeA: number
  stakeB: number
  result: 'SUCCESS' | 'FAILED' | string
  timestamp: string
}

export interface LogEntry {
  id: string
  timestamp: string
  level: string
  message: string
}

export interface AccountStatus {
  active: boolean
  ping: number | null
  providerStatus: 'RED' | 'GREEN'
  balance: number | null
}

export interface BackendState {
  /**
   * simple connection flag; clients may augment but backend owns truth
   */
  connection: boolean
  fsm: FSM
  /**
   * frontend-driven accounts map; backend must produce exactly this shape
   */
  accounts: {
    A: AccountStatus
    B: AccountStatus
  }
  gravity: GravityState
  sensors: SensorReading[]
  opportunities: Opportunity[]
  executionHistory: ExecutionRecord[]
  logs: LogEntry[]
  // legacy compatibility; to be removed once UI fully migrated
  accountA_active?: boolean
  accountB_active?: boolean
  providers?: any
  system?: any
}

