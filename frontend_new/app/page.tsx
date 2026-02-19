'use client'

import { useBackendState } from '../state/useBackendState'
import SystemStatus from '../components/SystemStatus'
import ControlPanel from '../components/ControlPanel'
import GravityBar from '../components/GravityBar'
import ArbitrageTable from '../components/ArbitrageTable'
import ExecutionHistory from '../components/ExecutionHistory'
import SensorPanel from '../components/SensorPanel'
// System logs moved to global LogsPanel in layout; remove duplicate ErrorStream here
import AccountPanel from '../components/AccountPanel'
import LiveScanner from '../components/LiveScanner'
import AdminPanel from '../components/AdminPanel'

export default function Page() {
  const state = useBackendState()

  if (!state) return <div>Connecting...</div>
  return (
    <main className="flex-1 flex flex-col min-w-0 bg-background-dark/50 p-4 gap-4 overflow-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0 h-auto">
        <AccountPanel account={'A'} state={state} />
        <AccountPanel account={'B'} state={state} />
      </div>

      <div className="flex flex-col gap-4 flex-1 min-h-0">
        <ExecutionHistory state={state} />

        <AdminPanel />

        <div className="flex-1 bg-surface-dark border border-border-dark rounded-lg flex flex-col min-h-0 shadow-sm">
          <div className="px-4 py-3 border-b border-border-dark flex justify-between items-center bg-background-dark/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">radar</span>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Live Scanner</h3>
            </div>
            <span className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/30">Running</span>
          </div>
          <div className="flex-1 overflow-auto custom-scroll relative">
            <LiveScanner state={state} />
          </div>
        </div>

        {/* System Logs panel unified in layout — removed duplicate ErrorStream here */}
      </div>
    </main>
  )
}