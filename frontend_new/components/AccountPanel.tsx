 'use client'

import React, { useState } from 'react'
import { BackendState } from '../types'
import { toggleAccount, setUrl } from '../websocket/client'

 export default function AccountPanel({ account, state }: { account: 'A' | 'B', state: BackendState }) {
   const isA = account === 'A'
   // minimal mapping - these fields should come from backend state in a full implementation
  const balance = isA ? (state.executionHistory.length ? '$4,250.00' : '$0.00') : '$0.00'
  // Derive ping from backend single-source contract: primary_ping_ms / secondary_ping_ms
  const acctRuntime = (state as any)[account] || (account === 'A' ? (state as any).A : (state as any).B) || null
  const systemState = (state as any).system || (state as any)
  const rawPing = account === 'A' ? (systemState.primary_ping_ms ?? null) : (systemState.secondary_ping_ms ?? null)
  const ping = rawPing != null ? rawPing : '—'

  // simple local toggle component defined inline to avoid creating new file
  function AccountToggle({ isA }: { isA: boolean }) {
    const acc = isA ? 'A' : 'B'
    // initialize enabled from backend state if available; default OFF
    const initial = (isA ? (state as any).accountA_active : (state as any).accountB_active) || false
    const [enabled, setEnabled] = useState<boolean>(initial)

    // keep toggle in sync with backend updates — derive single backend value
    const backendVal = isA ? (state as any).accountA_active : (state as any).accountB_active
    React.useEffect(() => {
      if (typeof backendVal === 'boolean') setEnabled(backendVal)
    }, [backendVal])

    const handleClick = async () => {
      try {
        await toggleAccount(acc as 'A' | 'B', !enabled)
        // optimistic local flip while backend-state refresh will correct if needed
        setEnabled(!enabled)
      } catch (err) {
        console.error('[AccountToggle] handleClick error', err)
      }
    }

    return (
      <button
        aria-pressed={enabled}
        aria-label={isA ? 'Toggle primary account' : 'Toggle secondary account'}
        onClick={handleClick}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${enabled ? 'bg-green-500 text-black' : 'bg-gray-700 text-white'}`}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
    )
  }

    // Provider status MUST be derived only from backend account runtime fields
    // Use `state.A` / `state.B` shape produced by backend.getState() when available
    const acct = acctRuntime
    const runtimeState: string = acct?.state || 'IDLE'
    const streamActive: boolean = !!acct?.streamActive
    const providerTargetId: string | null = acct?.providerTargetId || null

    // Map runtime state to UI indicator color per invariant
    const indicatorClass = runtimeState === 'RUNNING'
      ? 'bg-success shadow-[0_0_5px_rgba(34,197,94,0.6)]'
      : runtimeState === 'PROVIDER_READY'
        ? 'bg-yellow-400'
        : runtimeState === 'BROWSER_READY'
          ? 'bg-blue-400'
          : 'bg-slate-600'

    return (
      <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`size-8 rounded bg-blue-900/30 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-900/50`}>{account}</div>
            <div>
              <h4 className="text-white text-sm font-semibold">{isA ? 'Primary Account' : 'Secondary Account'}</h4>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className={`size-1.5 rounded-full ${isA ? 'bg-success' : 'bg-danger'}`}></span>
                <span>{isA ? 'Connected' : 'Stopped'}</span>
              </div>
            </div>
          </div>

          <div>
            <AccountToggle isA={isA} />
          </div>
        </div>

        <div className="relative bg-background-dark rounded border border-border-dark p-2 flex items-center gap-2 mt-3">
          <span className="material-symbols-outlined text-slate-500 text-[18px]">link</span>
          <div className="flex gap-2">
            <input aria-label="Whitelabel URL" defaultValue="" id={`wl-${account}`} className="bg-transparent border-none text-slate-300 text-xs w-full p-0 focus:ring-0 placeholder-slate-600 font-mono tracking-wide" placeholder="Whitelabel URL..." type="text" />
            <button className="text-xs px-2 py-1 bg-primary/10 rounded" onClick={async () => {
              const el = document.getElementById(`wl-${account}`) as HTMLInputElement | null
              if (!el) return
              const v = el.value.trim()
              if (!v) return
              try { await setUrl(account, v) } catch (e) { console.error(e) }
            }}>Set</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="bg-background-dark rounded p-2 border border-border-dark/50">
            <span className="text-xs text-slate-500 uppercase block mb-1">Balance</span>
            <span className="text-lg font-bold text-white font-mono">{balance}</span>
          </div>
          <div className="bg-background-dark rounded p-2 border border-border-dark/50">
            <span className="text-xs text-slate-500 uppercase block mb-1">Ping</span>
            <span className="text-lg font-bold text-success font-mono">{ping}</span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1 bg-background-dark/30 p-2 rounded border border-border-dark/30 mt-3">
          <div className="w-full flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${indicatorClass}`}></div>
              <div className="text-xs text-slate-300">
                {runtimeState}{streamActive ? ' · active' : ''}
              </div>
            </div>
            <div className="ml-4 text-xs text-slate-400">Provider: {providerTargetId || 'unbound'}</div>
          </div>
        </div>
      </div>
    )
 }
