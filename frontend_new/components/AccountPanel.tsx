 'use client'

 import React from 'react'
import { BackendState } from '../types'
import { sendCommand } from '../websocket/client'

 export default function AccountPanel({ account, state }: { account: 'A' | 'B', state: BackendState }) {
   const isA = account === 'A'
   // minimal mapping - these fields should come from backend state in a full implementation
   const balance = isA ? (state.executionHistory.length ? '$4,250.00' : '$0.00') : '$0.00'
   const ping = isA ? '45 ms' : '-- ms'

  return (
     <div className="bg-[#0f172a] border border-[#122231] rounded-lg p-4">
       <div className="flex items-center justify-between mb-3">
         <div>
           <div className="text-sm font-bold text-white">{isA ? 'Primary Account' : 'Secondary Account'}</div>
           <div className="text-xs text-slate-400">{isA ? 'Connected' : 'Stopped'}</div>
         </div>
         <div className="flex items-center gap-3">
          <div className="text-sm text-slate-300">{balance}</div>
          <div className="text-xs text-slate-400">Ping: <span className="text-green-400 font-bold">{ping}</span></div>
          {/* Toggle for enabling/disabling this account */}
          <div className="flex items-center gap-2 ml-2">
            <label className="text-xs text-slate-300">{isA ? 'Enabled' : 'Enabled'}</label>
            <input
              type="checkbox"
              className="h-4 w-4"
              onChange={(e) => {
                const checked = e.target.checked
                if (checked) sendCommand('toggle_on', { account: isA ? 'A' : 'B' })
                else sendCommand('toggle_off', { account: isA ? 'A' : 'B' })
              }}
            />
          </div>
         </div>
       </div>

       <div className="grid grid-cols-2 gap-3">
         <div className="bg-[#071827] p-2 rounded text-xs text-slate-300">Endpoints</div>
         <div className="bg-[#071827] p-2 rounded text-xs text-slate-300">Status</div>
       </div>
     </div>
   )
 }
