 'use client'

import { BackendState } from '../types'

export default function ErrorStream({ state }: { state: BackendState }) {
  return (
    <div className="bg-[#1a2332] border border-[#2a374f] rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4">System Logs</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {state.logs.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            No logs yet
          </div>
        ) : (
          state.logs.map((log) => (
            <div key={log.id} className={`p-3 rounded border ${
              log.level === 'error' ? 'bg-red-500/10 border-red-500/30' :
              log.level === 'warn' ? 'bg-yellow-500/10 border-yellow-500/30' :
              'bg-blue-500/10 border-blue-500/30'
            }`}>
              <div className="flex items-start gap-3">
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  log.level === 'error' ? 'bg-red-500/20 text-red-400' :
                  log.level === 'warn' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {log.level.toUpperCase()}
                </span>
                <div className="flex-1">
                  <div className="text-white text-sm">{log.message}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}