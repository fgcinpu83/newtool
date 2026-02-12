 'use client'

 import React from 'react'

 export default function TopHeader() {
   return (
     <header className="w-full bg-[#061426] border-b border-[#0f2433] py-3">
       <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-between">
         <div className="flex items-center gap-4">
           <div className="text-lg font-bold text-white">Stitch</div>
           <div className="text-sm text-slate-400 hidden md:block">Bot Config & Monitor v2.0</div>
         </div>

         <div className="flex items-center gap-4">
           <div className="text-sm text-slate-400">System Online</div>
           <div className="bg-[#0f172a] border border-[#233244] px-3 py-1 rounded text-sm">Admin User</div>
         </div>
       </div>
     </header>
   )
 }
