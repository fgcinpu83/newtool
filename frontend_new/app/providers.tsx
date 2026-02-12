'use client';

import ErrorBoundary from '../components/ErrorBoundary'
import { SystemStatusProvider } from './lib/SystemStatusProvider';

export default function SystemBootstrap({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <SystemStatusProvider>
        {children}
      </SystemStatusProvider>
    </ErrorBoundary>
  );
}