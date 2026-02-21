'use client'

import React from 'react'
import { BackendState } from '../types'
import { toggleAccount, setUrl } from '../websocket/client'

export default function AccountPanel({ account, state }: { account: 'A' | 'B'; state: BackendState }) {
  const acct = state.accounts[account]
  const balance = acct.balance != null ? `$${acct.balance.toFixed(2)}` : '$0.00'
  const ping = acct.ping != null ? acct.ping : '—'
  const providerColor = acct.providerStatus === 'GREEN' ? 'bg-success' : 'bg-danger'

  const handleToggle = async () => {
    try {
      await toggleAccount(account, !acct.active)
    } catch (e) {
      console.error('[AccountPanel] toggle failed', e)
    }
  }

  return (
    <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className={`size-8 rounded bg-blue-900/30 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-900/50`}>{account}</div>
          <div>
            <h4 className="text-white text-sm font-semibold">
              {account === 'A' ? 'Primary Account' : 'Secondary Account'}
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className={`size-1.5 rounded-full ${acct.active ? 'bg-success' : 'bg-danger'}`}></span>
              <span>{acct.active ? 'Connected' : 'Stopped'}</span>
            </div>
          </div>
        </div>

        <button
          aria-pressed={acct.active}
          aria-label={`Toggle account ${account}`}
          onClick={handleToggle}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            acct.active ? 'bg-green-500 text-black' : 'bg-gray-700 text-white'
          }`}
        >
          {acct.active ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="relative bg-background-dark rounded border border-border-dark p-2 flex items-center gap-2 mt-3">
        <span className="material-symbols-outlined text-slate-500 text-[18px]">link</span>
        <div className="flex gap-2">
          <input
            aria-label="Whitelabel URL"
            defaultValue=""
            id={`wl-${account}`}
            className="bg-transparent border-none text-slate-300 text-xs w-full p-0 focus:ring-0 placeholder-slate-600 font-mono tracking-wide"
            placeholder="Whitelabel URL..."
            type="text"
          />
          <button
            className="text-xs px-2 py-1 bg-primary/10 rounded"
            onClick={async () => {
              const el = document.getElementById(`wl-${account}`) as HTMLInputElement | null
              if (!el) return
              const v = el.value.trim()
              if (!v) return
              try {
                await setUrl(account, v)
              } catch (e) {
                console.error(e)
              }
            }}
          >
            Set
          </button>
        </div>
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
        <div className="w-full flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${providerColor}`}></div>
            <div className="text-xs text-slate-300">
              Provider: {acct.providerStatus === 'GREEN' ? 'ready' : 'not ready'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
