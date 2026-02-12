'use client'

import { useEffect, useState } from 'react'
import { connect } from '../websocket/client'
import type { BackendState } from '../types'

const EMPTY_STATE: BackendState = {
  connection: {
    backendConnected: false,
    chromeConnected: false,
    injectedReady: false,
    cdpReady: false,
  },
  fsm: { state: 'IDLE' },
  gravity: { mode: 'STANDBY', activeOpportunities: 0 },
  sensors: [],
  opportunities: [],
  executionHistory: [],
  logs: [],
}

export function useBackendState(): BackendState {
  const [state, setState] = useState<BackendState>(EMPTY_STATE)

  useEffect(() => {
    // Only accept full BackendState messages. The backend MUST emit `backend_state`.
    connect((msg: BackendState) => {
      if (!msg || typeof msg !== 'object') return
      if (!('connection' in msg) || !('fsm' in msg)) return
      // Replace entire state — no merges, no derived fields.
      setState(msg)
    })
  }, [])

  return state
}
