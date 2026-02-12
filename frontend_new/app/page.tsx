'use client';

import React from 'react';
import { useSystemStatus } from './lib/SystemStatusProvider';

export default function Page() {
    const { connected, ready, emit } = useSystemStatus();

    const handleToggleOn = () => {
        emit('toggle_on', {});
    };

    const handleToggleOff = () => {
        emit('toggle_off', {});
    };

    return (
        <div className="bg-[#0f172a] text-slate-200 min-h-screen font-sans flex items-center justify-center">
            <div className="bg-[#1a2332] border border-[#2a374f] rounded-lg p-8 max-w-md w-full">
                <h1 className="text-2xl font-bold text-white mb-6 text-center">Antigravity System</h1>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-300">Backend Connected:</span>
                        <span className={`font-bold ${connected ? 'text-green-400' : 'text-red-400'}`}>
                            {connected ? '✅' : '❌'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-slate-300">System Ready:</span>
                        <span className={`font-bold ${ready ? 'text-green-400' : 'text-red-400'}`}>
                            {ready ? '✅' : '❌'}
                        </span>
                    </div>

                    <div className="pt-4 border-t border-[#2a374f]">
                        <div className="flex gap-4">
                            <button
                                onClick={handleToggleOn}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                            >
                                Toggle ON
                            </button>
                            <button
                                onClick={handleToggleOff}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                            >
                                Toggle OFF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}