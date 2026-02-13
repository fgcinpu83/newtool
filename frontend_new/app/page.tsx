'use client'

import { useBackendState } from '../state/useBackendState'
import SystemStatus from '../components/SystemStatus'
import ControlPanel from '../components/ControlPanel'
import GravityBar from '../components/GravityBar'
import ArbitrageTable from '../components/ArbitrageTable'
import ExecutionHistory from '../components/ExecutionHistory'
import SensorPanel from '../components/SensorPanel'
import ErrorStream from '../components/ErrorStream'
import AccountPanel from '../components/AccountPanel'
import LiveScanner from '../components/LiveScanner'

export default function Page() {
  const state = useBackendState()

  if (!state) return <div>Connecting...</div>
  return (
    <main className="flex-1 flex flex-col min-w-0 bg-background-dark/50 p-4 gap-4 overflow-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0 h-auto">
        <AccountPanel account={'A'} state={state} />
        <AccountPanel account={'B'} state={state} />
      </div>

      <div className="flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex-1 bg-surface-dark border border-border-dark rounded-lg flex flex-col min-h-0 shadow-sm">
          <div className="px-4 py-3 border-b border-border-dark flex justify-between items-center bg-background-dark/20">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">history</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Execution History</h3>
              </div>
              <div className="hidden md:flex items-center bg-background-dark border border-border-dark rounded overflow-hidden">
                <input className="bg-transparent border-none text-[10px] text-slate-400 h-6 py-0 pl-2 pr-0 focus:ring-0 cursor-pointer w-24" type="date" value="2023-11-14" readOnly />
                <span className="text-slate-600 px-1 text-[10px]">-</span>
                <input className="bg-transparent border-none text-[10px] text-slate-400 h-6 py-0 pl-0 pr-2 focus:ring-0 cursor-pointer w-24" type="date" value="2023-11-15" readOnly />
              </div>
              <div className="h-4 w-px bg-border-dark"></div>
              <div className="flex items-center bg-background-dark rounded border border-border-dark p-0.5">
                <button className="flex items-center justify-center p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors" title="Silent">
                  <span className="material-symbols-outlined text-[14px]">notifications_off</span>
                </button>
                <button className="flex items-center justify-center p-1 rounded bg-surface-dark text-primary shadow-sm border border-border-dark/50" title="Audible">
                  <span className="material-symbols-outlined text-[14px]">notifications_active</span>
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-400">Today: <span className="text-profit-blue font-bold">+$1,240</span></div>
          </div>

          <div className="flex-1 overflow-auto custom-scroll relative">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-dark z-10 text-[10px] uppercase text-slate-400 font-semibold tracking-wider shadow-sm">
                <tr>
                  <th className="px-4 py-3 border-b border-border-dark w-20 text-center">Time</th>
                  <th className="px-4 py-3 border-b border-border-dark w-28 text-center">WL / Provider</th>
                  <th className="px-4 py-3 border-b border-border-dark text-center">Match</th>
                  <th className="px-4 py-3 border-b border-border-dark text-center">Pick</th>
                  <th className="px-4 py-3 border-b border-border-dark w-16 text-center">Odds</th>
                  <th className="px-4 py-3 border-b border-border-dark w-20 text-center">Stake</th>
                  <th className="px-4 py-3 border-b border-border-dark w-24 text-center">Status</th>
                  <th className="px-4 py-3 border-b border-border-dark w-16 text-center">W/L</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-border-dark font-display">
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2 text-slate-500 text-center align-middle">1:30:33</td>
                  <td className="px-4 py-2 text-slate-400 font-medium text-center align-middle">QQ11/sbo</td>
                  <td className="px-4 py-2 text-center text-white font-bold align-middle">MU</td>
                  <td className="px-4 py-2 text-center align-middle">
                    <div className="grid grid-cols-2 gap-1 items-center justify-center">
                      <span className="text-[11px] text-slate-300 font-medium">FT HDP</span>
                      <span className="text-[11px] text-profit-blue font-bold">0.25</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center text-danger font-bold align-middle">0.95</td>
                  <td className="px-4 py-2 text-center text-white align-middle">$110</td>
                  <td className="px-4 py-2 text-center align-middle"><span className="text-success font-medium">Accepted</span></td>
                  <td className="px-4 py-2 text-center text-slate-500 align-middle"></td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2 text-slate-500 text-center align-middle">1:32:45</td>
                  <td className="px-4 py-2 text-slate-400 font-medium text-center align-middle">nov/saba</td>
                  <td className="px-4 py-2 text-center text-white font-bold align-middle">Arsenal</td>
                  <td className="px-4 py-2 text-center align-middle">
                    <div className="grid grid-cols-2 gap-1 items-center justify-center">
                      <span className="text-[11px] text-slate-300 font-medium">FT HDP</span>
                      <span className="text-[11px] text-danger font-bold">-0.25</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center text-success font-bold align-middle">1.1</td>
                  <td className="px-4 py-2 text-center text-white align-middle">$100</td>
                  <td className="px-4 py-2 text-center align-middle"><span className="text-success font-medium">Accepted</span></td>
                  <td className="px-4 py-2 text-center text-slate-500 align-middle"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex-1 bg-surface-dark border border-border-dark rounded-lg flex flex-col min-h-0 shadow-sm">
          <div className="px-4 py-3 border-b border-border-dark flex justify-between items-center bg-background-dark/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">radar</span>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Live Scanner</h3>
            </div>
            <span className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/30">Running</span>
          </div>
          <div className="flex-1 overflow-auto custom-scroll relative">
            <LiveScanner state={state} />
          </div>
        </div>

        <div className="flex flex-col gap-0 bg-surface-dark border border-border-dark rounded-lg shrink-0 h-48 lg:h-56 shadow-sm overflow-hidden">
          <div className="flex border-b border-border-dark bg-background-dark/30">
            <button className="px-4 py-2 text-xs font-medium text-primary border-b-2 border-primary bg-surface-dark">All Logs</button>
            <button className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white border-b-2 border-transparent hover:bg-white/5">Backend</button>
            <button className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white border-b-2 border-transparent hover:bg-white/5">Frontend</button>
            <div className="ml-auto flex items-center pr-2">
              <span className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer hover:text-white"><span className="material-symbols-outlined text-[14px]">delete</span> Clear</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto custom-scroll p-2 bg-[#0c1017] font-mono text-[11px] leading-relaxed">
            <div className="text-slate-400"><span className="text-blue-500">[14:02:46]</span> <span className="text-yellow-500">[WS:MSG]</span> Received odds update for matchId: 882910 (Man City vs Arsenal).</div>
            <div className="text-slate-400"><span className="text-blue-500">[14:02:46]</span> <span className="text-green-500">[SCAN]</span> Gap identified: 2.4% &gt; Min 1.5%. Triggering execution logic.</div>
            <div className="text-slate-400"><span className="text-blue-500">[14:02:46]</span> <span className="text-purple-500">[EXEC]</span> Placing bet on Account A. Selection: Over 2.5 Goals @ 0.95 (HK). Stake: 500.</div>
            <div className="text-slate-400"><span className="text-blue-500">[14:02:47]</span> <span className="text-purple-500">[EXEC]</span> <span className="text-white bg-blue-900/50 px-1 rounded">API REQUEST</span> Sent to /place-order endpoint. Waiting for response...</div>
            <div className="text-slate-400"><span className="text-blue-500">[14:02:48]</span> <span className="text-purple-500">[EXEC]</span> <span className="text-green-400 bg-green-900/20 px-1 rounded">SUCCESS</span> Order placed successfully. Ticket ID: #99281. Status: PENDING.</div>
            <div className="text-slate-500"><span className="text-slate-600">[14:02:50]</span> <span className="text-slate-500">[HB]</span> Heartbeat check to Redis service... OK.</div>
            <div className="text-slate-400"><span className="text-blue-500">[14:02:55]</span> <span className="text-yellow-500">[WS:MSG]</span> Received odds update for matchId: 882912. No gap found.</div>
            <div className="text-slate-400"><span className="text-blue-500">[14:02:58]</span> <span className="text-red-400">[WARN]</span> Latency spike detected on Account B feed (120ms).</div>
          </div>
          <div className="bg-surface-dark border-t border-border-dark px-4 py-2 flex items-center justify-between gap-6 shrink-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success lamp-active shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[10px] font-bold text-slate-300 tracking-wider">REDIS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success lamp-active shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[10px] font-bold text-slate-300 tracking-wider">WEBSOCKET</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success lamp-active shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[10px] font-bold text-slate-300 tracking-wider">QUEUE (0)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success lamp-active shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[10px] font-bold text-slate-300 tracking-wider">WORKERS (4/4)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success lamp-active shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[10px] font-bold text-slate-300 tracking-wider">EXECUTION</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Build: v2.0.4-stable</div>
          </div>
        </div>
      </div>
    </main>
  )
}