import { BackendState } from '../types'

export default function GravityBar({ state }: { state: BackendState }) {
  return (
    <div className="bg-[#1a2332] border border-[#2a374f] rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4">Gravity Control</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-300">Mode:</span>
          <span className="font-bold text-purple-400">{state.gravity.mode}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-300">Active Opportunities:</span>
          <span className="font-bold text-yellow-400">{state.gravity.activeOpportunities}</span>
        </div>
      </div>
    </div>
  )
}