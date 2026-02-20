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
          accountA_active: accountA ? accountA.fsm === 'ACTIVE' : (prev as any).accountA_active,
          accountB_active: accountB ? accountB.fsm === 'ACTIVE' : (prev as any).accountB_active
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
    // Accept polling snapshots from /api/system/state and store as single `system` payload
    const onPolled = (ev: any) => {
      try {
        const payload = ev && ev.detail ? ev.detail : null
        if (!payload) return
        setState(prev => ({ ...prev, system: payload }))
      } catch (e) { }
    }
    window.addEventListener('system:polled', onPolled as any)

    // Also proactively poll backend so we don't rely on event ordering between hooks
    let mounted = true
    const fetchSystemState = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/system/state')
        if (!res.ok) return
        const s = await res.json()
        if (!mounted) return
        setState(prev => ({ ...prev, system: s }))
      } catch (e) {
        // ignore
      }
    }
    fetchSystemState()
    const pollId = setInterval(fetchSystemState, 5000)

    return () => { window.removeEventListener('system:polled', onPolled as any); mounted = false; clearInterval(pollId) }
  }, [])

  return state
}

// Poll backend authoritative system state as a fallback and primary source for UI
// This ensures balances, pings, and execution state come from backend (step 4/5).
export function useBackendPolling() {
  const [, setTick] = useState(0)

  useEffect(() => {
    let mounted = true
    const fetchSystemState = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/system/state')
        if (!res.ok) return
        const s = await res.json()
        // dispatch global window event so components can consume if needed
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
