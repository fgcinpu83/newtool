'use client';

import React, { useState, useEffect } from 'react';

/**
 * DUMMY MATCH DATA - Simulasi scanning arbitrage
 * Data ini untuk preview design, akan diganti dengan real data nanti
 */
const DUMMY_MATCHES = [
    {
        id: 'ARB_001',
        home: 'Manchester United',
        away: 'Liverpool FC',
        league: 'English Premier League',
        kickoff: '2026-02-04T19:30:00',
        accountA: {
            provider: 'SABA',
            market: 'Full Time Handicap',
            selection: 'Man United -0.5',
            odds: 2.15,
            line: '-0.5',
            age: 2, // seconds since last update
        },
        accountB: {
            provider: 'AFB88',
            market: 'Full Time Handicap',
            selection: 'Liverpool +0.5',
            odds: 1.98,
            line: '+0.5',
            age: 1,
        },
        profit: 3.45,
        status: 'LIVE',
    },
    {
        id: 'ARB_002',
        home: 'Real Madrid',
        away: 'Barcelona',
        league: 'La Liga',
        kickoff: '2026-02-04T21:00:00',
        accountA: {
            provider: 'SABA',
            market: 'Over/Under',
            selection: 'Over 2.5',
            odds: 1.92,
            line: '2.5',
            age: 5,
        },
        accountB: {
            provider: 'AFB88',
            market: 'Over/Under',
            selection: 'Under 2.5',
            odds: 2.05,
            line: '2.5',
            age: 3,
        },
        profit: 2.18,
        status: 'LIVE',
    },
    {
        id: 'ARB_003',
        home: 'Bayern Munich',
        away: 'Dortmund',
        league: 'Bundesliga',
        kickoff: '2026-02-04T20:30:00',
        accountA: {
            provider: 'SABA',
            market: 'Full Time Handicap',
            selection: 'Bayern -1.0',
            odds: 2.08,
            line: '-1.0',
            age: 8,
        },
        accountB: {
            provider: 'AFB88',
            market: 'Full Time Handicap',
            selection: 'Dortmund +1.0',
            odds: 1.95,
            line: '+1.0',
            age: 12,
        },
        profit: 1.85,
        status: 'STALE', // More than 10 seconds old
    },
    {
        id: 'ARB_004',
        home: 'PSG',
        away: 'Marseille',
        league: 'Ligue 1',
        kickoff: '2026-02-04T20:00:00',
        accountA: {
            provider: 'SABA',
            market: 'Full Time Handicap',
            selection: 'PSG -0.75',
            odds: 1.88,
            line: '-0.75',
            age: 1,
        },
        accountB: {
            provider: 'AFB88',
            market: 'Full Time Handicap',
            selection: 'Marseille +0.75',
            odds: 2.22,
            line: '+0.75',
            age: 2,
        },
        profit: 4.12,
        status: 'LIVE',
    },
    {
        id: 'ARB_005',
        home: 'Juventus',
        away: 'AC Milan',
        league: 'Serie A',
        kickoff: '2026-02-04T18:45:00',
        accountA: {
            provider: 'SABA',
            market: 'Over/Under',
            selection: 'Over 2.25',
            odds: 2.02,
            line: '2.25',
            age: 4,
        },
        accountB: {
            provider: 'AFB88',
            market: 'Over/Under',
            selection: 'Under 2.25',
            odds: 1.98,
            line: '2.25',
            age: 6,
        },
        profit: 0.45, // Below threshold, for demo
        status: 'LIVE',
    },
];

/**
 * Scanner Component dengan dummy data
 */
export default function ScannerDemo() {
    const [matches, setMatches] = useState(DUMMY_MATCHES);
    const [filter, setFilter] = useState({
        minProfit: 1.0,
        showStale: false,
    });
    const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

    // Simulate real-time age updates
    useEffect(() => {
        const interval = setInterval(() => {
            setMatches(prev => prev.map(m => ({
                ...m,
                accountA: { ...m.accountA, age: m.accountA.age + 1 },
                accountB: { ...m.accountB, age: m.accountB.age + 1 },
                status: (m.accountA.age > 10 || m.accountB.age > 10) ? 'STALE' : 'LIVE',
            })));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Filter matches
    const filteredMatches = matches.filter(m => {
        if (m.profit < filter.minProfit) return false;
        if (!filter.showStale && m.status === 'STALE') return false;
        return true;
    });

    const getAgeColor = (age: number) => {
        if (age <= 3) return 'text-green-400';
        if (age <= 10) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getAgeLabel = (age: number) => {
        if (age <= 3) return '🟢 FRESH';
        if (age <= 10) return '🟡 OK';
        return '🔴 STALE';
    };

    const getProfitColor = (profit: number) => {
        if (profit >= 3) return 'text-green-400 bg-green-500/10';
        if (profit >= 2) return 'text-emerald-400 bg-emerald-500/10';
        if (profit >= 1) return 'text-yellow-400 bg-yellow-500/10';
        return 'text-slate-400 bg-slate-500/10';
    };

    return (
        <div className="min-h-screen bg-[#0a0f1a] text-slate-200 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white mb-2">🎯 Arbitrage Scanner</h1>
                <p className="text-slate-400 text-sm">Real-time odds comparison • Account A (SABA) vs Account B (AFB88)</p>
            </div>

            {/* Config Bar */}
            <div className="flex items-center gap-6 mb-6 p-4 bg-[#111827] rounded-xl border border-[#1f2937]">
                {/* Account A Config */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span className="text-sm font-semibold text-white">Account A</span>
                    </div>
                    <select className="bg-[#1f2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        <option value="SABA">SABA</option>
                        <option value="AFB88">AFB88</option>
                    </select>
                    <input 
                        type="text" 
                        placeholder="URL (e.g., qq188.com)" 
                        className="bg-[#1f2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white w-48 focus:outline-none focus:border-blue-500"
                        defaultValue="qq188.com"
                    />
                </div>

                <div className="w-px h-8 bg-[#374151]"></div>

                {/* Account B Config */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                        <span className="text-sm font-semibold text-white">Account B</span>
                    </div>
                    <select className="bg-[#1f2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        <option value="AFB88">AFB88</option>
                        <option value="SABA">SABA</option>
                    </select>
                    <input 
                        type="text" 
                        placeholder="URL (e.g., mpo.com)" 
                        className="bg-[#1f2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white w-48 focus:outline-none focus:border-blue-500"
                        defaultValue="mpo.com"
                    />
                </div>

                <div className="w-px h-8 bg-[#374151]"></div>

                {/* Filters */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Min Profit:</span>
                    <input 
                        type="number" 
                        step="0.5"
                        value={filter.minProfit}
                        onChange={(e) => setFilter(f => ({ ...f, minProfit: parseFloat(e.target.value) || 0 }))}
                        className="bg-[#1f2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white w-20 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-400">%</span>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox"
                        checked={filter.showStale}
                        onChange={(e) => setFilter(f => ({ ...f, showStale: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-600 bg-[#1f2937]"
                    />
                    <span className="text-sm text-slate-300">Show Stale</span>
                </label>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-[#111827] rounded-xl p-4 border border-[#1f2937]">
                    <div className="text-xs text-slate-400 mb-1">Active Opportunities</div>
                    <div className="text-2xl font-bold text-white">{filteredMatches.length}</div>
                </div>
                <div className="bg-[#111827] rounded-xl p-4 border border-[#1f2937]">
                    <div className="text-xs text-slate-400 mb-1">Best Profit</div>
                    <div className="text-2xl font-bold text-green-400">
                        {Math.max(...filteredMatches.map(m => m.profit)).toFixed(2)}%
                    </div>
                </div>
                <div className="bg-[#111827] rounded-xl p-4 border border-[#1f2937]">
                    <div className="text-xs text-slate-400 mb-1">Account A Balance</div>
                    <div className="text-2xl font-bold text-blue-400">$5,240.00</div>
                </div>
                <div className="bg-[#111827] rounded-xl p-4 border border-[#1f2937]">
                    <div className="text-xs text-slate-400 mb-1">Account B Balance</div>
                    <div className="text-2xl font-bold text-purple-400">$4,890.00</div>
                </div>
            </div>

            {/* Scanner Table */}
            <div className="bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-[#0d1117] border-b border-[#1f2937] text-xs font-semibold text-slate-400 uppercase">
                    <div className="col-span-3">Match</div>
                    <div className="col-span-2 text-center">Account A (SABA)</div>
                    <div className="col-span-1 text-center">Odds A</div>
                    <div className="col-span-2 text-center">Account B (AFB88)</div>
                    <div className="col-span-1 text-center">Odds B</div>
                    <div className="col-span-1 text-center">Profit</div>
                    <div className="col-span-1 text-center">Age</div>
                    <div className="col-span-1 text-center">Action</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-[#1f2937]">
                    {filteredMatches.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            No arbitrage opportunities found with current filters
                        </div>
                    ) : (
                        filteredMatches.map((match) => (
                            <div 
                                key={match.id}
                                className={`grid grid-cols-12 gap-2 px-4 py-4 hover:bg-[#1f2937]/50 transition-colors ${
                                    selectedMatch === match.id ? 'bg-blue-500/10 border-l-2 border-blue-500' : ''
                                } ${match.status === 'STALE' ? 'opacity-60' : ''}`}
                            >
                                {/* Match Info */}
                                <div className="col-span-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`w-2 h-2 rounded-full ${match.status === 'LIVE' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                                        <span className="text-white font-semibold text-sm">{match.home}</span>
                                        <span className="text-slate-500 text-xs">vs</span>
                                        <span className="text-white font-semibold text-sm">{match.away}</span>
                                    </div>
                                    <div className="text-xs text-slate-500">{match.league}</div>
                                </div>

                                {/* Account A Selection */}
                                <div className="col-span-2 flex flex-col justify-center">
                                    <div className="text-xs text-blue-400 font-medium">{match.accountA.market}</div>
                                    <div className="text-sm text-white">{match.accountA.selection}</div>
                                </div>

                                {/* Odds A */}
                                <div className="col-span-1 flex items-center justify-center">
                                    <span className="bg-blue-500/20 text-blue-400 font-mono font-bold px-3 py-1 rounded-lg text-lg">
                                        {match.accountA.odds.toFixed(2)}
                                    </span>
                                </div>

                                {/* Account B Selection */}
                                <div className="col-span-2 flex flex-col justify-center">
                                    <div className="text-xs text-purple-400 font-medium">{match.accountB.market}</div>
                                    <div className="text-sm text-white">{match.accountB.selection}</div>
                                </div>

                                {/* Odds B */}
                                <div className="col-span-1 flex items-center justify-center">
                                    <span className="bg-purple-500/20 text-purple-400 font-mono font-bold px-3 py-1 rounded-lg text-lg">
                                        {match.accountB.odds.toFixed(2)}
                                    </span>
                                </div>

                                {/* Profit */}
                                <div className="col-span-1 flex items-center justify-center">
                                    <span className={`font-mono font-bold px-3 py-1 rounded-lg text-lg ${getProfitColor(match.profit)}`}>
                                        {match.profit.toFixed(2)}%
                                    </span>
                                </div>

                                {/* Age Indicator */}
                                <div className="col-span-1 flex flex-col items-center justify-center">
                                    <span className={`text-xs font-mono ${getAgeColor(Math.max(match.accountA.age, match.accountB.age))}`}>
                                        {Math.max(match.accountA.age, match.accountB.age)}s
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                        {getAgeLabel(Math.max(match.accountA.age, match.accountB.age))}
                                    </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="col-span-1 flex items-center justify-center gap-1">
                                    <button 
                                        onClick={() => setSelectedMatch(match.id)}
                                        className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
                                        title="Bet Account A"
                                    >
                                        <span className="text-xs font-bold">A</span>
                                    </button>
                                    <button 
                                        onClick={() => setSelectedMatch(match.id)}
                                        className="p-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
                                        title="Bet Account B"
                                    >
                                        <span className="text-xs font-bold">B</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Quick Bet Panel (shows when match selected) */}
            {selectedMatch && (
                <div className="fixed bottom-0 left-0 right-0 bg-[#111827] border-t border-[#1f2937] p-4 shadow-2xl">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-white font-bold">Quick Bet Panel</div>
                                <div className="text-sm text-slate-400">
                                    Selected: {matches.find(m => m.id === selectedMatch)?.home} vs {matches.find(m => m.id === selectedMatch)?.away}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-400">Stake:</span>
                                    <input 
                                        type="number"
                                        defaultValue={100}
                                        className="bg-[#1f2937] border border-[#374151] rounded-lg px-3 py-2 text-white w-24"
                                    />
                                </div>
                                <button className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-2 rounded-lg transition-colors">
                                    🎯 Focus Tab A
                                </button>
                                <button className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-6 py-2 rounded-lg transition-colors">
                                    🎯 Focus Tab B
                                </button>
                                <button 
                                    onClick={() => setSelectedMatch(null)}
                                    className="text-slate-400 hover:text-white p-2"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex items-center gap-6 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span>LIVE - Data fresh</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span>STALE - Data old (&gt;10s)</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-blue-500/20"></span>
                    <span>Account A (SABA)</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-purple-500/20"></span>
                    <span>Account B (AFB88)</span>
                </div>
            </div>
        </div>
    );
}
