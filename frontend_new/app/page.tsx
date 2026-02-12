'use client'

import { useBackendState } from '../state/useBackendState'
import SystemStatus from '../components/SystemStatus'
import ControlPanel from '../components/ControlPanel'
import GravityBar from '../components/GravityBar'
import ArbitrageTable from '../components/ArbitrageTable'
import ExecutionHistory from '../components/ExecutionHistory'
import SensorPanel from '../components/SensorPanel'
import ErrorStream from '../components/ErrorStream'
import AccountPanel from '../components/AccountPanel'
import LiveScanner from '../components/LiveScanner'

export default function Page() {
  const state = useBackendState()

  if (!state) return <div>Connecting...</div>

  return (
    <main className="min-h-screen bg-[#071528] text-slate-200 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <h1 className="text-3xl font-bold text-center mb-4">Antigravity System</h1>

        {/* Top Account Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AccountPanel account={'A'} state={state} />
          <AccountPanel account={'B'} state={state} />
        </div>

        {/* Execution History + Live Scanner */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <ExecutionHistory state={state} />
            <ArbitrageTable state={state} />
          </div>
          <div className="space-y-4">
            <LiveScanner state={state} />
            <SensorPanel state={state} />
          </div>
        </div>

        {/* Logs */}
        <div>
          <ErrorStream state={state} />
        </div>
      </div>
    </main>
  )
}