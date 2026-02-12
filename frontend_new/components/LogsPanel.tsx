 'use client'

 import React from 'react'
 import { BackendState } from '../types'
 import ErrorStream from './ErrorStream'

 // Small wrapper to reserve space at bottom for logs similar to screenshot
 export default function LogsPanel({ state }: { state?: BackendState }) {
   // If no state passed, ErrorStream will show empty placeholder
   const emptyState: BackendState = state || {
     connection: { backendConnected: false, chromeConnected: false, injectedReady: false, cdpReady: false },
     fsm: { state: 'IDLE' },
     gravity: { mode: 'STANDBY', activeOpportunities: 0 },
     sensors: [],
     opportunities: [],
     executionHistory: [],
     logs: []
   }

   return (
     <div className="bg-[#071827] border border-[#122231] rounded-lg p-3">
       <div className="flex items-center justify-between mb-2">
         <div className="text-sm text-slate-300 font-bold">Activity Logs</div>
         <div className="text-xs text-slate-500">Today: +$1,240</div>
       </div>
       <ErrorStream state={emptyState} />
     </div>
   )
 }
