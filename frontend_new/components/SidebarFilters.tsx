 'use client'

import React from 'react'

export default function SidebarFilters() {
   return (
     <div className="space-y-6">
      <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">GLOBAL FILTERS</h3>
        <div className="text-xs text-slate-400 mb-2">Match Source</div>
        <div className="flex gap-2 mb-3">
          <button className="px-2 py-1 rounded bg-background-dark text-slate-300 text-xs">Live</button>
          <button className="px-2 py-1 rounded bg-background-dark text-slate-300 text-xs">Prematch</button>
          <button className="px-2 py-1 rounded bg-primary text-white text-xs">Both</button>
        </div>

        <div className="text-xs text-slate-400 mb-2">Profit Min/Max %</div>
        <label htmlFor="profitRange" className="sr-only">Profit range</label>
        <input id="profitRange" aria-label="Profit range" className="w-full h-2 bg-background-dark rounded mb-3" type="range" min="1" max="20" defaultValue={2} />

        <div className="text-xs text-slate-400 mb-2">Stake Config</div>
        <div className="space-y-2">
          <div className="bg-background-dark rounded p-2 text-sm">Tier 1 (Major) <span className="float-right text-green-400">Active</span></div>
          <div className="bg-background-dark rounded p-2 text-sm">Tier 2 (Secondary) <span className="float-right text-slate-400">Active</span></div>
          <div className="bg-background-dark rounded p-2 text-sm">Tier 3 (Other) <span className="float-right text-slate-400">Inactive</span></div>
        </div>

        <div className="mt-4">
          <button className="w-full bg-primary text-white py-2 rounded font-bold">Apply Configuration</button>
        </div>
      </div>

      <div className="text-xs text-slate-500">Logs preview available in main view.</div>
     </div>
   )
 }
