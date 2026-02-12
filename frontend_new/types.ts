export type FSMState = 'IDLE' | 'STARTING' | 'RUNNING' | 'STOPPING'

export interface ConnectionState {
  backendConnected: boolean
  chromeConnected: boolean
  injectedReady: boolean
  cdpReady: boolean
}

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

export interface BackendState {
  connection: ConnectionState
  fsm: FSM
  gravity: GravityState
  sensors: SensorReading[]
  opportunities: Opportunity[]
  executionHistory: ExecutionRecord[]
  logs: LogEntry[]
}

