 'use client'

import React, { useEffect, useState } from 'react'
import { BackendState } from '../types'
import ErrorStream from './ErrorStream'

 // Small wrapper to reserve space at bottom for logs similar to screenshot
export default function LogsPanel({ state }: { state?: BackendState }) {
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    const fetchLogs = async () => {
      try {
        const r = await fetch('/api/logs')
        if (!r.ok) return
        const d = await r.json()
        if (mounted && Array.isArray(d)) setLogs(d)
      } catch (e) {
        console.warn('Failed to fetch logs', e)
      }
    }
    fetchLogs()
    const id = setInterval(fetchLogs, 3000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  // If no state passed, ErrorStream will show empty placeholder
  const emptyState: BackendState = state || {
    connection: { backendConnected: false, chromeConnected: false, injectedReady: false, cdpReady: false },
    fsm: { state: 'IDLE' },
    gravity: { mode: 'STANDBY', activeOpportunities: 0 },
    sensors: [],
    opportunities: [],
    executionHistory: [],
    logs: logs
  }

  return (
    <div className="bg-surface-dark border border-border-dark rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-white font-semibold">System Logs</div>
        <div className="text-xs text-slate-400">Live</div>
      </div>
      <ErrorStream state={emptyState} />
    </div>
  )
}
