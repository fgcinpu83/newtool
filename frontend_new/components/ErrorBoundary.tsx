'use client'

import React from 'react'

type Props = { children: React.ReactNode }

export default class ErrorBoundary extends React.Component<Props, { hasError: boolean }> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // Do not send commands or change state; just log for debugging
    // In production hook this to remote error tracking
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#071028] text-slate-200">
          <div className="max-w-lg text-center p-6 bg-[#0f172a] border border-[#2a374f] rounded">
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-400">The UI encountered an error. Please reload the page.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
