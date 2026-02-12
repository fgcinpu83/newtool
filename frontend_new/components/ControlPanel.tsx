'use client'

import { BackendState } from '../types'
import { sendCommand } from '../websocket/client'

export default function ControlPanel({ state }: { state: BackendState }) {
  return (
    <div className="bg-surface-dark border border-border-dark rounded-lg p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Control Panel</h2>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">Primary (Account A)</div>
            <button
              disabled={state.fsm.state !== 'IDLE'}
              onClick={() => sendCommand('TOGGLE_ACCOUNT', { account: 'A', active: true })}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                state.fsm.state === 'IDLE'
                  ? 'bg-primary hover:bg-primary/90 text-black'
                  : 'bg-background-dark text-slate-400 cursor-not-allowed'
              }`}
            >
              Enable A
            </button>

            <button
              disabled={state.fsm.state !== 'RUNNING'}
              onClick={() => sendCommand('TOGGLE_ACCOUNT', { account: 'A', active: false })}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                state.fsm.state === 'RUNNING'
                  ? 'bg-danger hover:bg-danger/90 text-white'
                  : 'bg-background-dark text-slate-400 cursor-not-allowed'
              }`}
            >
              Disable A
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">Secondary (Account B)</div>
            <button
              disabled={state.fsm.state !== 'IDLE'}
              onClick={() => sendCommand('TOGGLE_ACCOUNT', { account: 'B', active: true })}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                state.fsm.state === 'IDLE'
                  ? 'bg-primary hover:bg-primary/90 text-black'
                  : 'bg-background-dark text-slate-400 cursor-not-allowed'
              }`}
            >
              Enable B
            </button>

            <button
              disabled={state.fsm.state !== 'RUNNING'}
              onClick={() => sendCommand('TOGGLE_ACCOUNT', { account: 'B', active: false })}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                state.fsm.state === 'RUNNING'
                  ? 'bg-danger hover:bg-danger/90 text-white'
                  : 'bg-background-dark text-slate-400 cursor-not-allowed'
              }`}
            >
              Disable B
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}