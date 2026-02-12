 'use client'

import React from 'react'
 import { BackendState } from '../types'

 export default function LiveScanner({ state }: { state: BackendState }) {
  return (
    <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white">LIVE SCANNER</div>
        <div className="text-xs text-slate-400">{state.opportunities.length ? 'Running' : 'Idle'}</div>
      </div>

      <div className="overflow-auto max-h-64">
        {state.opportunities.length === 0 ? (
          <div className="text-center text-slate-400 py-8">Waiting for data...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs">
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">Provider</th>
                <th className="text-left py-2">Match</th>
                <th className="text-right py-2">Odds</th>
                <th className="text-right py-2">Profit</th>
              </tr>
            </thead>
            <tbody>
              {state.opportunities.map((o) => (
                <tr key={o.id} className="border-t border-border-dark/40">
                  <td className="py-2 text-slate-400">{new Date(o.timestamp || Date.now()).toLocaleTimeString()}</td>
                  <td className="py-2 text-white">{o.providerA}</td>
                  <td className="py-2 text-white">{o.providerA} vs {o.providerB}</td>
                  <td className="py-2 text-right text-blue-400">{o.oddsA.toFixed(2)}</td>
                  <td className="py-2 text-right text-green-400">+{o.profitPercent.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
