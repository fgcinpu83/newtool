export interface BackendState {
  connection: {
    backendConnected: boolean
    chromeConnected: boolean
    injectedReady: boolean
    cdpReady: boolean
  }

  fsm: {
    state: 'IDLE' | 'STARTING' | 'RUNNING' | 'STOPPING'
  }

  gravity: {
    mode: string
    activeOpportunities: number
  }

  sensors: {
    id: string
    provider: string
    lastPacket: string
  }[]

  opportunities: {
    id: string
    providerA: string
    providerB: string
    oddsA: number
    oddsB: number
    profitPercent: number
    status: string
  }[]

  executionHistory: {
    id: string
    pair: string
    stakeA: number
    stakeB: number
    result: string
    timestamp: string
  }[]

  logs: {
    id: string
    message: string
    level: string
    timestamp: string
  }[]
}