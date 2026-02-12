'use client'

import { useBackendState } from '../state/useBackendState'
import SystemStatus from '../components/SystemStatus'
import ControlPanel from '../components/ControlPanel'
import GravityBar from '../components/GravityBar'
import ArbitrageTable from '../components/ArbitrageTable'
import ExecutionHistory from '../components/ExecutionHistory'
import SensorPanel from '../components/SensorPanel'
import ErrorStream from '../components/ErrorStream'

export default function Page() {
  const state = useBackendState()

  if (!state) return <div>Connecting...</div>

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-200 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <h1 className="text-3xl font-bold text-center mb-8">Antigravity System</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <SystemStatus state={state} />
          <ControlPanel state={state} />
          <GravityBar state={state} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ArbitrageTable state={state} />
          <ExecutionHistory state={state} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SensorPanel state={state} />
          <ErrorStream state={state} />
        </div>
      </div>
    </main>
  )
}