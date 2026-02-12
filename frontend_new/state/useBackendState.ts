'use client'

import { useEffect, useState, useCallback } from 'react'
import { connect } from '../websocket/client'
import { BackendState } from '../types'

const initialState: BackendState = {
  connection: {
    backendConnected: false,
    chromeConnected: false,
    injectedReady: false,
    cdpReady: false
  },
  fsm: {
    state: 'IDLE'
  },
  gravity: {
    mode: 'STANDBY',
    activeOpportunities: 0
  },
  sensors: [],
  opportunities: [],
  executionHistory: [],
  logs: []
}

export function useBackendState() {
  const [state, setState] = useState<BackendState>(initialState)

  const handleMessage = useCallback((data: any) => {
    setState(prevState => {
      if (data.accountA_active !== undefined || data.accountB_active !== undefined) {
        // system_status event
        return {
          ...prevState,
          connection: {
            ...prevState.connection,
            backendConnected: true
          },
          fsm: {
            state: data.accountA_active || data.accountB_active ? 'RUNNING' : 'IDLE'
          }
        }
      }

      if (data.chromeReady !== undefined) {
        // pipeline:readiness event
        return {
          ...prevState,
          connection: {
            ...prevState.connection,
            chromeConnected: data.chromeReady,
            injectedReady: data.injectedReady,
            cdpReady: data.cdpReady
          }
        }
      }

      if (data.fromState !== undefined) {
        // fsm:transition event
        return {
          ...prevState,
          fsm: {
            state: data.toState as 'IDLE' | 'STARTING' | 'RUNNING' | 'STOPPING'
          }
        }
      }

      if (data.level !== undefined) {
        // system_log event
        const newLog = {
          id: Date.now().toString(),
          message: data.message,
          level: data.level,
          timestamp: new Date().toISOString()
        }
        return {
          ...prevState,
          logs: [newLog, ...prevState.logs.slice(0, 49)] // Keep last 50 logs
        }
      }

      // For other events, return current state
      return prevState
    })
  }, [])

  useEffect(() => {
    connect(handleMessage)
  }, [handleMessage])

  return state
}