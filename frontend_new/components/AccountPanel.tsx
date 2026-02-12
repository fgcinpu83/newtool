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
    const [enabled, setEnabled] = useState(false)
    const acc = isA ? 'A' : 'B'
    const handleClick = () => {
      if (enabled) {
        sendCommand('toggle_off', { account: acc })
      } else {
        sendCommand('toggle_on', { account: acc })
      }
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
    const hasSaba = !!state.sensors?.some(s => /saba/i.test(s.provider))
    const hasAfb = !!state.sensors?.some(s => /afb/i.test(s.provider) || /afb88/i.test(s.provider))

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
           <span className={`inline-block w-3 h-3 rounded-full ${hasSaba ? 'bg-green-400' : 'bg-gray-600'}`}></span>
           <span className="text-xs text-slate-300">SABA</span>
         </div>
         <div className="flex items-center gap-2">
           <span className={`inline-block w-3 h-3 rounded-full ${hasAfb ? 'bg-green-400' : 'bg-gray-600'}`}></span>
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
