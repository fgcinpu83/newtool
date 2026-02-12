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
                {(() => {
                  const rows = [] as JSX.Element[]
                  const ops = state.opportunities
                  for (let i = 0; i < ops.length; i += 2) {
                    const a = ops[i]
                    const b = ops[i + 1]
                    // first row of the pair: includes Profit cell with rowspan=2 when a pair exists
                    rows.push(
                      <tr key={a.id} className="border-t border-border-dark/40">
                        <td className="py-2 text-slate-400">{new Date(a.timestamp || Date.now()).toLocaleTimeString()}</td>
                        <td className="py-2 text-white">{a.providerA}</td>
                        <td className="py-2 text-white">{a.providerA} vs {a.providerB}</td>
                        <td className="py-2 text-right text-blue-400">{a.oddsA.toFixed(2)}</td>
                        {b ? (
                          <td rowSpan={2} className="py-2 text-right align-middle text-profit-blue font-bold">{Math.round(a.profitPercent)}%</td>
                        ) : (
                          <td className="py-2 text-right text-profit-blue font-bold">{Math.round(a.profitPercent)}%</td>
                        )}
                      </tr>
                    )

                    if (b) {
                      rows.push(
                        <tr key={b.id} className="border-t border-border-dark/40">
                          <td className="py-2 text-slate-400">{new Date(b.timestamp || Date.now()).toLocaleTimeString()}</td>
                          <td className="py-2 text-white">{b.providerA}</td>
                          <td className="py-2 text-white">{b.providerA} vs {b.providerB}</td>
                          <td className="py-2 text-right text-blue-400">{b.oddsA.toFixed(2)}</td>
                        </tr>
                      )
                    }
                  }
                  return rows
                })()}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
