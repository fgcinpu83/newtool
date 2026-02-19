'use client';

import ErrorBoundary from '../components/ErrorBoundary'
import { SystemStatusProvider } from './lib/SystemStatusProvider';
import HydrationWatcher from '../components/HydrationWatcher'
import { useBackendPolling } from '../state/useBackendState'

export default function SystemBootstrap({ children }: { children: React.ReactNode }) {
  useBackendPolling()
  return (
    <ErrorBoundary>
      <SystemStatusProvider>
        <HydrationWatcher />
        {children}
      </SystemStatusProvider>
    </ErrorBoundary>
  );
}