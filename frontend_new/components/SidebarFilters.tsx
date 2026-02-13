 'use client'

import React, { useState } from 'react'

export default function SidebarFilters() {
  const [matchSource, setMatchSource] = useState<'live'|'prematch'|'both'>('both')
  const [profitMin, setProfitMin] = useState<number>(1)
  const [profitMax, setProfitMax] = useState<number>(10)
  const [tiers, setTiers] = useState([
    { id: 'tier1', name: 'Tier 1 (Major)', active: true, amount: 100 },
    { id: 'tier2', name: 'Tier 2 (Secondary)', active: true, amount: 50 },
    { id: 'tier3', name: 'Tier 3 (Other)', active: false, amount: 10 },
  ])
  const [betTypes, setBetTypes] = useState({
    ft_hdp: true,
    ht_hdp: true,
    ft_ou: true,
    ht_ou: false,
  })

  function applyConfig() {
    const cfg = { matchSource, profitMin, profitMax, tiers, betTypes }
    console.log('Apply configuration', cfg)
    // dispatch a DOM event so other parts of app can listen if needed
    window.dispatchEvent(new CustomEvent('app:apply-config', { detail: cfg }))
  }

   return (
     <div className="space-y-6">
      <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">GLOBAL FILTERS</h3>
        <div className="text-xs text-slate-400 mb-2">Match Source</div>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setMatchSource('live')}
            className={`px-2 py-1 rounded text-xs ${matchSource === 'live' ? 'bg-primary text-white' : 'bg-background-dark text-slate-300'}`}>
            Live
          </button>
          <button
            onClick={() => setMatchSource('prematch')}
            className={`px-2 py-1 rounded text-xs ${matchSource === 'prematch' ? 'bg-primary text-white' : 'bg-background-dark text-slate-300'}`}>
            Prematch
          </button>
          <button
            onClick={() => setMatchSource('both')}
            className={`px-2 py-1 rounded text-xs ${matchSource === 'both' ? 'bg-primary text-white' : 'bg-background-dark text-slate-300'}`}>
            Both
          </button>
        </div>

        <div className="text-xs text-slate-400 mb-2">Profit Min/Max %</div>
        <div className="flex gap-2 mb-3">
          <label className="sr-only" htmlFor="profitMin">Profit min</label>
          <input
            id="profitMin"
            type="number"
            min={0}
            max={100}
            value={profitMin}
            onChange={(e) => setProfitMin(Number(e.target.value))}
            className="w-1/2 bg-background-dark rounded p-2 text-sm text-white"
          />
          <label className="sr-only" htmlFor="profitMax">Profit max</label>
          <input
            id="profitMax"
            type="number"
            min={0}
            max={100}
            value={profitMax}
            onChange={(e) => setProfitMax(Number(e.target.value))}
            className="w-1/2 bg-background-dark rounded p-2 text-sm text-white"
          />
        </div>

        <div className="text-xs text-slate-400 mb-2">Stake Config</div>
        <div className="space-y-2">
          {tiers.map((t, idx) => (
            <div key={t.id} className="bg-background-dark rounded p-2 text-sm flex items-center gap-2">
              <input
                id={`chk-${t.id}`}
                type="checkbox"
                aria-label={`Enable ${t.name}`}
                checked={t.active}
                onChange={() => {
                  const copy = [...tiers]
                  copy[idx] = { ...copy[idx], active: !copy[idx].active }
                  setTiers(copy)
                }}
                className="w-4 h-4"
              />
              <label htmlFor={`chk-${t.id}`} className="flex-1 text-sm text-slate-200">{t.name}</label>
              <input
                type="number"
                aria-label={`Stake amount for ${t.name}`}
                min={0}
                value={t.amount}
                onChange={(e) => {
                  const val = Number(e.target.value || 0)
                  const copy = [...tiers]
                  copy[idx] = { ...copy[idx], amount: val }
                  setTiers(copy)
                }}
                className="w-24 bg-surface-dark rounded p-1 text-sm text-white text-right"
                disabled={!t.active}
              />
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-400 mt-4 mb-2">Bet Types</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="flex items-center gap-2 text-sm">
            <input aria-label="FT Hdp" type="checkbox" checked={betTypes.ft_hdp} onChange={() => setBetTypes({...betTypes, ft_hdp: !betTypes.ft_hdp})} />
            <span className="text-slate-200">FT Hdp</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input aria-label="HT Hdp" type="checkbox" checked={betTypes.ht_hdp} onChange={() => setBetTypes({...betTypes, ht_hdp: !betTypes.ht_hdp})} />
            <span className="text-slate-200">HT Hdp</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input aria-label="FT O/U" type="checkbox" checked={betTypes.ft_ou} onChange={() => setBetTypes({...betTypes, ft_ou: !betTypes.ft_ou})} />
            <span className="text-slate-200">FT O/U</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input aria-label="HT O/U" type="checkbox" checked={betTypes.ht_ou} onChange={() => setBetTypes({...betTypes, ht_ou: !betTypes.ht_ou})} />
            <span className="text-slate-200">HT O/U</span>
          </label>
        </div>
      </div>

      <div className="text-xs text-slate-500">Logs preview available in main view.</div>
     </div>
   )
 }
