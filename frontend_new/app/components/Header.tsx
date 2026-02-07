'use client';

import { useSystemStatus } from '../lib/SystemStatusProvider';

interface HeaderProps {
  chromeStatus: { connected: boolean; tabs: number };
}

export default function Header({ chromeStatus }: HeaderProps) {
  const { connected, ready } = useSystemStatus();

  return (
    <header className="flex items-center justify-between border-b border-[#2a374f] bg-[#1a2332] px-6 py-3 h-16 shrink-0 z-20">
      <div className="flex items-center gap-4 text-white">
        <div className="size-8 flex items-center justify-center bg-[#2b6cee]/20 rounded-lg text-[#2b6cee]">
          <span className="material-symbols-outlined">analytics</span>
        </div>
        <h2 className="text-lg font-bold">Bot Config & Monitor v2.0</h2>
      </div>
      <div className="flex items-center gap-6">
        {/* Chrome Status Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
          chromeStatus.connected
            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
            : 'bg-red-500/10 text-red-400 border border-red-500/30'
        }`}>
          <span className={`size-2 rounded-full ${chromeStatus.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span>Chrome {chromeStatus.connected ? `(${chromeStatus.tabs} tabs)` : 'Offline'}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className={`size-2 rounded-full ${
            ready ? 'bg-[#22c55e] lamp-active' :
            connected ? 'bg-yellow-500 lamp-active' :
            'bg-[#ef4444]'
          }`}></span>
          <span>{ready ? 'SYSTEM READY' : connected ? 'System Online' : 'Offline'}</span>
        </div>
        <div className="h-8 w-[1px] bg-[#2a374f]"></div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">Admin User</span>
          <div className="size-9 rounded-full bg-slate-600 border-2 border-[#2b6cee]/30"></div>
        </div>
      </div>
    </header>
  );
}