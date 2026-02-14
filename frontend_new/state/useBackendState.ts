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
    // Accept either the full BackendState (legacy) or the new { accounts: [...] } shape.
    connect((msg: any) => {
      if (!msg || typeof msg !== 'object') return

      // Full state message (legacy): replace entire state
      if ('connection' in msg && 'fsm' in msg) {
        setState(msg as BackendState)
        return
      }

      // New compact accounts-only message: map into expected shape for compatibility
      if (Array.isArray(msg.accounts)) {
        const accounts: { accountId: string; fsm: string }[] = msg.accounts
        const accountA = accounts.find(a => a.accountId === 'A')
        const accountB = accounts.find(a => a.accountId === 'B')

        setState(prev => ({
          ...prev,
          // connection fields left unchanged
          // derive per-account active flags from FSM == RUNNING
          // keep previous fsm.state for backward compatibility but prefer Account A
          fsm: { state: (accountA?.fsm || accountB?.fsm || prev.fsm.state) as any },
          accountA_active: accountA ? accountA.fsm === 'RUNNING' : (prev as any).accountA_active,
          accountB_active: accountB ? accountB.fsm === 'RUNNING' : (prev as any).accountB_active
        }))
        return
      }
      // otherwise ignore
    })
    // Also listen for system_status updates and merge important fields
    try {
      const s = (window as any).__NEWTOOL_SOCKET__
      if (s) {
        s.on('system_status', (data: any) => {
          if (!data) return
          setState(prev => ({ ...prev, accountA_active: data.accountA_active, accountB_active: data.accountB_active, providers: data.providers }))
        })
      }
    } catch (e) { }
  }, [])

  return state
}
