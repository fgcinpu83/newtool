'use client'

import React, { useEffect, useState } from 'react'
import { useSystemStatus } from '../app/lib/SystemStatusProvider'
import { sendCommand } from '../websocket/client'

type ProviderContract = {
  id?: number
  accountId: 'A' | 'B'
  endpointPattern: string
  method: string
  requestSchema?: string | null
  responseSchema?: string | null
  createdAt?: number
}

type ExecRow = {
  id?: number
  timestamp: number
  match: string
  providerA: string
  providerB: string
  stakeA: number
  stakeB: number
  profitResult: string
}

export default function AdminPanel() {
  const { on, off } = useSystemStatus()
  const [contracts, setContracts] = useState<{ A?: ProviderContract | null; B?: ProviderContract | null }>({ A: null, B: null })
  const [dbHistory, setDbHistory] = useState<ExecRow[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    const handleContracts = (payload: any) => {
      setContracts({ A: payload?.A || null, B: payload?.B || null })
      setLoadingContracts(false)
    }
    const handleHistory = (rows: ExecRow[]) => {
      setDbHistory(Array.isArray(rows) ? rows : [])
      setLoadingHistory(false)
    }

    on('provider_contracts', handleContracts)
    on('execution_history_db', handleHistory)

    // initial fetch
    refreshContracts()

    return () => {
      off('provider_contracts', handleContracts)
      off('execution_history_db', handleHistory)
    }
  }, [on, off])

  function refreshContracts() {
    setLoadingContracts(true)
    sendCommand('LIST_PROVIDER_CONTRACTS')
  }

  function removeContract(account: 'A' | 'B') {
    if (!confirm(`Remove provider contract for account ${account}?`)) return
    setLoadingContracts(true)
    sendCommand('DELETE_PROVIDER_CONTRACT', { accountId: account })
    // backend will emit updated provider_contracts; also request list to be safe
    setTimeout(() => sendCommand('LIST_PROVIDER_CONTRACTS'), 300)
  }

  function loadDbHistory() {
    setLoadingHistory(true)
    sendCommand('GET_EXECUTION_HISTORY', { limit: 200 })
  }

  return (
    <div className="bg-surface-dark border border-border-dark rounded-lg p-6 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Admin — Provider Contracts & DB History</h3>
        <div className="flex items-center gap-2">
          <button onClick={refreshContracts} className="px-3 py-1 bg-primary/10 text-primary text-sm rounded border border-primary/20">Refresh Contracts</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm text-slate-300 mb-2">Provider Contracts</h4>
          <div className="space-y-3">
            {loadingContracts ? (
              <div className="text-sm text-slate-400">Loading...</div>
            ) : (
              ['A', 'B'].map((acc) => {
                const c = (contracts as any)[acc]
                return (
                  <div key={acc} className="bg-background-dark rounded p-3 border border-border-dark/50 flex justify-between items-start">
                    <div>
                      <div className="text-white font-medium">Account {acc}</div>
                      {c ? (
                        <div className="text-sm text-slate-400 mt-1">
                          <div className="font-mono text-xs text-emerald-300">{c.method} {c.endpointPattern}</div>
                          <div className="text-xs mt-1">Assigned: {c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500 italic mt-1">No provider contract</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => removeContract(acc as 'A' | 'B')} className="text-xs text-red-400 bg-red-500/5 px-2 py-1 rounded border border-red-500/10">Remove</button>
                      <button onClick={() => sendCommand('LIST_PROVIDER_CONTRACTS')} className="text-xs text-slate-400 bg-slate-700/10 px-2 py-1 rounded">Refresh</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
