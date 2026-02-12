 'use client'

import React from 'react'

export default function TopHeader() {
  return (
    <header className="flex items-center justify-between border-b border-border-dark bg-surface-dark px-6 py-3 shrink-0 h-16 z-20">
      <div className="flex items-center gap-4 text-white">
        <div className="w-10 h-10 flex items-center justify-center bg-primary/20 rounded-lg text-primary">
          <span className="material-symbols-outlined">analytics</span>
        </div>
        <div>
          <h2 className="text-white text-lg font-bold leading-tight">Bot Config & Monitor</h2>
          <div className="text-xs text-slate-400">v2.0</div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_6px_rgba(34,197,94,0.6)]"></span>
            <span className="text-slate-300">System Online</span>
          </div>
        </div>

        <div className="h-8 w-px bg-border-dark" />

        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-white">Admin User</div>
          <div className="w-9 h-9 rounded-full border-2 border-primary/30 bg-cover bg-center" style={{ backgroundImage: 'url(https://lh3.googleusercontent.com/aida-public/AB6AXuDTAypNCWOfSArPqfS3IGj9mhAJPuOWQvA6fUZ8As6r8WYJ5tUmlLqA7JtF8OzUX-70oo64TtstS5iH6_48ZMu865XTFAG6qMJjqIeJMVyWybKrpzncC5ITo7x2hY5LrxX9XwtoG2AvzGpPsk1EVr4LEGXZFJYZI-AyEy2pls3vt_09zSL-nM2da85qc3ucbAuoyHHORSNexUCH7nlxSqlspgBdtpKIX3XqFDuTPeBKW9hUqNxEZ-wGoL_Nj26nOB7VbDCyoCDBdJY)' }} />
        </div>
      </div>
    </header>
  )
}
