'use client';

import ErrorBoundary from '../components/ErrorBoundary'
import { SystemStatusProvider } from './lib/SystemStatusProvider';
import HydrationWatcher from '../components/HydrationWatcher'

export default function SystemBootstrap({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <SystemStatusProvider>
        <HydrationWatcher />
        {children}
      </SystemStatusProvider>
    </ErrorBoundary>
  );
}