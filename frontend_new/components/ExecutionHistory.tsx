'use client'

import React, { useEffect, useState } from 'react'

type ExecRow = {
  id?: number
  timestamp: number
  pair?: string
  providerA?: string
  providerB?: string
  stakeA?: number
  stakeB?: number
  result?: string
}

export default function ExecutionHistory() {
  const [rows, setRows] = useState<ExecRow[]>([])

  useEffect(() => {
    let mounted = true
    const fetchHistory = async () => {
      try {
        const r = await fetch('/api/execution/history')
        if (!r.ok) return
        const data = await r.json()
        if (mounted) setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        console.warn('Failed to fetch execution history', e)
      }
    }
    fetchHistory()
    const id = setInterval(fetchHistory, 3000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  return (
    <div className="bg-surface-dark border border-border-dark rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-3">Execution History</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No execution history yet</div>
        ) : (
          rows.map((h) => (
            <div key={h.id} className="bg-background-dark rounded p-3 border border-border-dark/50">
              <div className="flex justify-between items-start mb-2">
                <span className="text-white font-medium">{h.pair || `${h.providerA || ''} / ${h.providerB || ''}`}</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  h.result === 'SUCCESS' ? 'bg-green-500/20 text-green-400' :
                  h.result === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {h.result}
                </span>
              </div>
              <div className="text-sm text-slate-400">
                Stake A: <span className="text-blue-400 font-mono">${h.stakeA || 0}</span>
                <span className="mx-2">|</span>
                Stake B: <span className="text-purple-400 font-mono">${h.stakeB || 0}</span>
              </div>
              <div className="text-xs text-slate-500 mt-2">{new Date(h.timestamp).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}