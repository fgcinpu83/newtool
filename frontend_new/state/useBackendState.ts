'use client'

import { useEffect, useState } from 'react'
import { connect } from '../websocket/client'
import type { BackendState } from '../types'

// initial state mirrors frontend-defined contract exactly
const EMPTY_STATE: BackendState = {
  connection: false,
  fsm: { state: 'IDLE' },
  accounts: {
    A: { active: false, ping: null, providerStatus: 'RED', balance: null },
    B: { active: false, ping: null, providerStatus: 'RED', balance: null },
  },
  gravity: { mode: 'STANDBY', activeOpportunities: 0 },
  sensors: [],
  opportunities: [],
  executionHistory: [],
  logs: [],
}

export function useBackendState(): BackendState {
  const [state, setState] = useState<BackendState>(EMPTY_STATE)

  useEffect(() => {
    // backend emits full BackendState; simply replace ours
    connect((msg: any) => {
      if (msg && typeof msg === 'object') {
        setState(msg as BackendState)
      }
    })

    const fetchSystemState = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/system/state')
        if (!res.ok) return
        const s = await res.json()
        setState(s as BackendState)
      } catch (e) {
        // ignore
      }
    }
    fetchSystemState()
    const id = setInterval(fetchSystemState, 5000)
    return () => clearInterval(id)
  }, [])

  return state
}

// polling wrapper left intact for legacy consumers of system:polled events
export function useBackendPolling() {
  const [, setTick] = useState(0)

  useEffect(() => {
    let mounted = true
    const fetchSystemState = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/system/state')
        if (!res.ok) return
        const s = await res.json()
        if (mounted) {
          window.dispatchEvent(new CustomEvent('system:polled', { detail: s }))
          setTick(t => t + 1)
        }
      } catch (e) {
        // ignore - keep UI resilient
      }
    }
    fetchSystemState()
    const id = setInterval(fetchSystemState, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [])
}
