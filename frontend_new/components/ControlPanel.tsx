'use client'

import { BackendState } from '../types'
import { sendCommand } from '../websocket/client'

export default function ControlPanel({ state }: { state: BackendState }) {
  return (
    <div className="bg-[#1a2332] border border-[#2a374f] rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">Control Panel</h2>
      <div className="space-y-3">
        <button
          disabled={state.fsm.state !== 'IDLE'}
          onClick={() => sendCommand('toggle_on')}
          className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
            state.fsm.state === 'IDLE'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          🚀 Toggle ON
        </button>

        <button
          disabled={state.fsm.state !== 'RUNNING'}
          onClick={() => sendCommand('toggle_off')}
          className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
            state.fsm.state === 'RUNNING'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          🛑 Toggle OFF
        </button>
      </div>
    </div>
  )
}