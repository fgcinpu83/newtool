import { BackendState } from '../types'

export default function ArbitrageTable({ state }: { state: BackendState }) {
  return (
    <div className="bg-[#1a2332] border border-[#2a374f] rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4">Live Arbitrage Opportunities</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a374f]">
              <th className="text-left py-2 px-3 text-slate-300 font-semibold">Provider A</th>
              <th className="text-left py-2 px-3 text-slate-300 font-semibold">Provider B</th>
              <th className="text-right py-2 px-3 text-slate-300 font-semibold">Odds A</th>
              <th className="text-right py-2 px-3 text-slate-300 font-semibold">Odds B</th>
              <th className="text-right py-2 px-3 text-slate-300 font-semibold">Profit %</th>
              <th className="text-center py-2 px-3 text-slate-300 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {state.opportunities.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  No arbitrage opportunities detected
                </td>
              </tr>
            ) : (
              state.opportunities.map((o) => (
                <tr key={o.id} className="border-b border-[#2a374f]/50 hover:bg-[#2a374f]/20">
                  <td className="py-3 px-3 text-white">{o.providerA}</td>
                  <td className="py-3 px-3 text-white">{o.providerB}</td>
                  <td className="py-3 px-3 text-right text-blue-400 font-mono">{o.oddsA.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-purple-400 font-mono">{o.oddsB.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-green-400 font-bold">
                    +{o.profitPercent.toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      o.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                      o.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}