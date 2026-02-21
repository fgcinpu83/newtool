import { BackendState } from '../types'

export default function SystemStatus({ state }: { state: BackendState }) {
  return (
    <div className="bg-[#1a2332] border border-[#2a374f] rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">System Status</h2>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-300">Backend:</span>
          <span className={`font-bold ${state.connection ? 'text-green-400' : 'text-red-400'}`}>
            {state.connection ? '✅ Connected' : '❌ Disconnected'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-300">FSM State:</span>
          <span className="font-bold text-blue-400">{state.fsm.state}</span>
        </div>
      </div>
    </div>
  )
}