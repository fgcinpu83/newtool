import { BackendState } from '../types'

export default function ExecutionHistory({ state }: { state: BackendState }) {
  return (
    <div className="bg-surface-dark border border-border-dark rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-3">Execution History</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {state.executionHistory.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No execution history yet</div>
        ) : (
          state.executionHistory.map((h) => (
            <div key={h.id} className="bg-background-dark rounded p-3 border border-border-dark/50">
              <div className="flex justify-between items-start mb-2">
                <span className="text-white font-medium">{h.pair}</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  h.result === 'SUCCESS' ? 'bg-green-500/20 text-green-400' :
                  h.result === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {h.result}
                </span>
              </div>
              <div className="text-sm text-slate-400">
                Stake A: <span className="text-blue-400 font-mono">${h.stakeA}</span>
                <span className="mx-2">|</span>
                Stake B: <span className="text-purple-400 font-mono">${h.stakeB}</span>
              </div>
              <div className="text-xs text-slate-500 mt-2">{new Date(h.timestamp).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}