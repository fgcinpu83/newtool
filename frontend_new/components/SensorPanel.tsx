import { BackendState } from '../types'

export default function SensorPanel({ state }: { state: BackendState }) {
  return (
    <div className="bg-[#1a2332] border border-[#2a374f] rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4">Sensor Status</h3>
      <div className="space-y-3">
        {state.sensors.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            No sensors active
          </div>
        ) : (
          state.sensors.map((s) => (
            <div key={s.id} className="bg-[#0f172a] rounded p-3 border border-[#2a374f]/50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-semibold">{s.provider}</span>
                <span className="text-green-400 text-sm">● Active</span>
              </div>
              <div className="text-sm text-slate-400">
                Last Packet: <span className="text-slate-300 font-mono">{s.lastPacket}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}