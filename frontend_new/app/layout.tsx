import './globals.css'
import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import TopHeader from '../components/TopHeader'
import SidebarFilters from '../components/SidebarFilters'
import LogsPanel from '../components/LogsPanel'
import SystemBootstrap from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Antigravity / Arbitrage System',
  description: 'Dashboard renderer',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-200 font-display h-screen flex flex-col overflow-auto`}>
        <SystemBootstrap>
          <TopHeader />

          <div className="flex flex-1">
            <aside className="w-80 flex flex-col border-r border-border-dark bg-surface-dark overflow-y-auto custom-scroll shrink-0 z-10">
              <div className="p-5 space-y-6">
                <SidebarFilters />
                <div className="pt-4 mt-auto">
                  <button className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                    Apply Configuration
                  </button>
                </div>
              </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 bg-background-dark/50 p-4 gap-4 overflow-auto">
              <div className="max-w-7xl mx-auto w-full">
                {children}
              </div>

              <div className="mt-4">
                <LogsPanel />
              </div>
            </main>
          </div>
        </SystemBootstrap>
      </body>
    </html>
  )
}
