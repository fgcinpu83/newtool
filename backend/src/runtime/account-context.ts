export type FSMState = 'IDLE' | 'STARTING' | 'WAIT_PROVIDER' | 'ACTIVE' | 'STOPPING'

export interface ProviderContract {
  endpointPattern: string
  method: string
  requestSchema?: any
  responseSchema?: any
  assignedAt?: number
}

export class AccountContext {
  public readonly accountId: 'A' | 'B'
  public url: string = ''
  public chromeProfilePath: string | null = null
  public cdpConnection: any = null
  public fsmState: FSMState = 'IDLE'
  public providerContract: ProviderContract | null = null
  public providerStatus: 'RED' | 'YELLOW' | 'GREEN' = 'RED'
  public balance: string = '0.00'
  public ping: number | null = null
  public oddsStreamActive: boolean = false
  public lastTrafficAt: number | null = null

  constructor(accountId: 'A' | 'B') {
    this.accountId = accountId
  }

  reset(): void {
    this.url = ''
    this.chromeProfilePath = null
    this.cdpConnection = null
    this.fsmState = 'IDLE'
    this.providerContract = null
    this.providerStatus = 'RED'
    this.balance = '0.00'
    this.ping = null
    this.oddsStreamActive = false
    this.lastTrafficAt = null
  }
}
