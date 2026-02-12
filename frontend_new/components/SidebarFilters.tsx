 'use client'

import React from 'react'

export default function SidebarFilters() {
   return (
     <div className="space-y-6">
       <div className="bg-[#0f172a] border border-[#122231] rounded-lg p-4">
         <h3 className="text-sm font-bold text-slate-300 mb-3">GLOBAL FILTERS</h3>
         <div className="text-xs text-slate-400 mb-2">Match Source</div>
         <div className="flex gap-2 mb-3">
           <button className="px-2 py-1 rounded bg-[#122231] text-slate-300 text-xs">Live</button>
           <button className="px-2 py-1 rounded bg-[#122231] text-slate-300 text-xs">Prematch</button>
           <button className="px-2 py-1 rounded bg-[#2b6cee] text-white text-xs">Both</button>
         </div>

         <div className="text-xs text-slate-400 mb-2">Profit Min/Max %</div>
         <label htmlFor="profitRange" className="sr-only">Profit range</label>
         <input id="profitRange" aria-label="Profit range" className="w-full h-2 bg-[#071827] rounded mb-3" type="range" min="1" max="20" defaultValue={2} />

         <div className="text-xs text-slate-400 mb-2">Stake Config</div>
         <div className="space-y-2">
           <div className="bg-[#071827] rounded p-2 text-sm">Tier 1 (Major) <span className="float-right text-green-400">Active</span></div>
           <div className="bg-[#071827] rounded p-2 text-sm">Tier 2 (Secondary) <span className="float-right text-slate-400">Active</span></div>
           <div className="bg-[#071827] rounded p-2 text-sm">Tier 3 (Other) <span className="float-right text-slate-400">Inactive</span></div>
         </div>

         <div className="mt-4">
           <button className="w-full bg-[#2b6cee] text-white py-2 rounded font-bold">Apply Configuration</button>
         </div>
       </div>

       <div className="text-xs text-slate-500">Logs preview available in main view.</div>
     </div>
   )
 }
