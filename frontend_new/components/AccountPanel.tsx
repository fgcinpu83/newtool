 'use client'

import React, { useState } from 'react'
import { BackendState } from '../types'
import { sendCommand } from '../websocket/client'

 export default function AccountPanel({ account, state }: { account: 'A' | 'B', state: BackendState }) {
   const isA = account === 'A'
   // minimal mapping - these fields should come from backend state in a full implementation
   const balance = isA ? (state.executionHistory.length ? '$4,250.00' : '$0.00') : '$0.00'
   const ping = isA ? '45 ms' : '-- ms'

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

    const handleClick = () => {
      try {
        // send canonical per-account toggle to backend
        sendCommand('TOGGLE_ACCOUNT', { account: acc, active: !enabled })
        setEnabled(!enabled)
      } catch (err) {
        console.error('[AccountToggle] handleClick error', err)
      }
    }

    return (
      <button
        aria-pressed={enabled ? 'true' : 'false'}
        aria-label={isA ? 'Toggle primary account' : 'Toggle secondary account'}
        onClick={handleClick}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${enabled ? 'bg-green-500 text-black' : 'bg-gray-700 text-white'}`}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
    )
  }

    // provider presence detection from backend sensors (best-effort)
    function getProviderStatus(providerRegex: RegExp) {
      const s = state.sensors?.find(sensor => providerRegex.test(sensor.provider))
      if (!s) return 'offline'
      // Try to infer freshness from lastPacket if it's a timestamp
      const lp = s.lastPacket
      // lastPacket may be ISO string or numeric timestamp or other; attempt parse
      const ts = Date.parse(lp)
      if (isNaN(ts)) {
        // unknown format — treat as warn (present but unknown freshness)
        return 'warn'
      }
      const age = Date.now() - ts
      if (age < 30_000) return 'ready' // <30s
      if (age < 120_000) return 'stale' // 30s-2m
      return 'error' // >2m
    }

    const sabaStatus = getProviderStatus(/saba/i)
    const afbStatus = getProviderStatus(/afb|afb88/i)

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
          <input aria-label="Whitelabel URL" defaultValue="" className="bg-transparent border-none text-slate-300 text-xs w-full p-0 focus:ring-0 placeholder-slate-600 font-mono tracking-wide" placeholder="Whitelabel URL..." type="text" />
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
          <div className="grid grid-cols-5 gap-4 w-full items-center">
            <div className="flex justify-center">
              <div className={`w-2.5 h-2.5 rounded-full ${sabaStatus === 'ready' ? 'bg-success shadow-[0_0_5px_rgba(34,197,94,0.6)]' : sabaStatus === 'stale' ? 'bg-warning' : sabaStatus === 'error' ? 'bg-danger' : 'bg-slate-600'}`}></div>
            </div>
            <div className="flex justify-center">
              <div className={`w-2.5 h-2.5 rounded-full ${afbStatus === 'ready' ? 'bg-success shadow-[0_0_5px_rgba(34,197,94,0.6)]' : afbStatus === 'stale' ? 'bg-warning' : afbStatus === 'error' ? 'bg-danger' : 'bg-slate-600'}`}></div>
            </div>
            <div className="flex justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
            </div>
            <div className="flex justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
            </div>
            <div className="flex justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-4 w-full mt-1 text-center">
            <div className="text-[10px] text-slate-400 uppercase font-medium">SABA</div>
            <div className="text-[10px] text-slate-400 uppercase font-medium">AFB88</div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
      </div>
    )
 }
