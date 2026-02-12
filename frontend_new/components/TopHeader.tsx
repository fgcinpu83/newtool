 'use client'

import React from 'react'

 export default function TopHeader() {
   return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-border-dark bg-surface-dark px-6 py-3 shrink-0 h-16 z-20">
      <div className="flex items-center gap-4 text-white">
        <div className="size-8 flex items-center justify-center bg-primary/20 rounded-lg text-primary">
          <span className="material-symbols-outlined">analytics</span>
        </div>
        <h2 className="text-white text-lg font-bold leading-tight tracking-tight">Bot Config & Monitor v2.0</h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="size-2 rounded-full bg-success lamp-active"></span>
          <span>System Online</span>
        </div>
        <div className="h-8 w-[1px] bg-border-dark"></div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">Admin User</span>
          <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border-2 border-primary/30" style={{ backgroundImage: 'url(https://lh3.googleusercontent.com/aida-public/AB6AXuDTAypNCWOfSArPqfS3IGj9mhAJPuOWQvA6fUZ8As6r8WYJ5tUmlLqA7JtF8OzUX-70oo64TtstS5iH6_48ZMu865XTFAG6qMJjqIeJMVyWybKrpzncC5ITo7x2hY5LrxX9XwtoG2AvzGpPsk1EVr4LEGXZFJYZI-AyEy2pls3vt_09zSL-nM2da85qc3ucbAuoyHHORSNexUCH7nlxSqlspgBdtpKIX3XqFDuTPeBKW9hUqNxEZ-wGoL_Nj26nOB7VbDCyoCDBdJY)' }} />
        </div>
      </div>
    </header>
   )
 }
