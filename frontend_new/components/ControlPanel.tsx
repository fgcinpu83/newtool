'use client'

import { BackendState } from '../types'
import { sendCommand } from '../websocket/client'

export default function ControlPanel({ state }: { state: BackendState }) {
  return (
    <div className="bg-[#1a2332] border border-[#2a374f] rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">Control Panel</h2>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-300">Primary (Account A)</div>
            <button
              disabled={state.fsm.state !== 'IDLE'}
              onClick={() => sendCommand('TOGGLE_ACCOUNT', { account: 'A', active: true })}
              className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
                state.fsm.state === 'IDLE'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              🚀 Toggle ON A
            </button>

            <button
              disabled={state.fsm.state !== 'RUNNING'}
              onClick={() => sendCommand('TOGGLE_ACCOUNT', { account: 'A', active: false })}
              className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
                state.fsm.state === 'RUNNING'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              🛑 Toggle OFF A
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-300">Secondary (Account B)</div>
            <button
              disabled={state.fsm.state !== 'IDLE'}
              onClick={() => sendCommand('TOGGLE_ACCOUNT', { account: 'B', active: true })}
              className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
                state.fsm.state === 'IDLE'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              🚀 Toggle ON B
            </button>

            <button
              disabled={state.fsm.state !== 'RUNNING'}
              onClick={() => sendCommand('TOGGLE_ACCOUNT', { account: 'B', active: false })}
              className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
                state.fsm.state === 'RUNNING'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              🛑 Toggle OFF B
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}