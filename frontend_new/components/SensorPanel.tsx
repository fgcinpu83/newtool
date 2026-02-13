 'use client'

import { BackendState } from '../types'

function statusClassFromLastPacket(lp?: string) {
  if (!lp) return 'bg-gray-600 text-xs'
  const ts = Date.parse(lp)
  if (isNaN(ts)) return 'bg-yellow-400 text-xs'
  const age = Date.now() - ts
  if (age < 30_000) return 'bg-success text-xs'
  if (age < 120_000) return 'bg-warning text-xs'
  return 'bg-danger text-xs'
}

export default function SensorPanel({ state }: { state: BackendState }) {
  return (
    <div className="bg-surface-dark border border-border-dark rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Sensor Status</h3>
      <div className="space-y-3">
        {state.sensors.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No sensors active</div>
        ) : (
          state.sensors.map((s) => (
            <div key={s.id} className="bg-background-dark rounded p-3 border border-border-dark/50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-medium">{s.provider}</span>
                <span className={`${statusClassFromLastPacket(s.lastPacket)} flex items-center gap-2 px-2 py-1 rounded-full`}>● <span className="ml-1 text-slate-800 opacity-90">{s.lastPacket ? 'Active' : 'Offline'}</span></span>
              </div>
              <div className="text-sm text-slate-400">Last Packet: <span className="text-slate-300 font-mono">{s.lastPacket}</span></div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}