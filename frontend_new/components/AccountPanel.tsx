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

    // keep toggle in sync with backend updates
    React.useEffect(() => {
      const backendVal = isA ? (state as any).accountA_active : (state as any).accountB_active
      if (typeof backendVal === 'boolean' && backendVal !== enabled) setEnabled(backendVal)
    }, [(state as any).accountA_active, (state as any).accountB_active])

    const handleClick = () => {
      // send canonical per-account toggle to backend
      sendCommand('TOGGLE_ACCOUNT', { account: acc, active: !enabled })
      setEnabled(!enabled)
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
      <div className="bg-[#1f2937] border border-[#122231] rounded-lg p-4">
       <div className="flex items-center justify-between mb-3">
         <div>
           <div className="text-sm font-bold text-white">{isA ? 'Primary Account' : 'Secondary Account'}</div>
           <div className="text-xs text-slate-400">{isA ? 'Connected' : 'Stopped'}</div>
         </div>
         <div className="flex items-center gap-3">
          <div className="text-sm text-slate-300">{balance}</div>
          <div className="text-xs text-slate-400">Ping: <span className="text-green-400 font-bold">{ping}</span></div>
          {/* Toggle button for enabling/disabling this account */}
          <div className="flex items-center gap-2 ml-2">
            <label className="sr-only">{isA ? 'Primary account enable' : 'Secondary account enable'}</label>
            <AccountToggle isA={isA} />
          </div>
         </div>
       </div>
       
       <div className="mt-3 flex items-center gap-3">
         <div className="flex items-center gap-2">
           <span className={`inline-block w-3 h-3 rounded-full ${sabaStatus === 'ready' ? 'bg-green-400' : sabaStatus === 'stale' ? 'bg-yellow-400' : sabaStatus === 'error' ? 'bg-red-500' : 'bg-gray-600'}`}></span>
           <span className="text-xs text-slate-300">SABA</span>
         </div>
         <div className="flex items-center gap-2">
           <span className={`inline-block w-3 h-3 rounded-full ${afbStatus === 'ready' ? 'bg-green-400' : afbStatus === 'stale' ? 'bg-yellow-400' : afbStatus === 'error' ? 'bg-red-500' : 'bg-gray-600'}`}></span>
           <span className="text-xs text-slate-300">AFB</span>
         </div>
       </div>

       <div className="grid grid-cols-2 gap-3">
         <div className="bg-[#071827] p-2 rounded text-xs text-slate-300">Endpoints</div>
         <div className="bg-[#071827] p-2 rounded text-xs text-slate-300">Status</div>
       </div>
     </div>
   )
 }
