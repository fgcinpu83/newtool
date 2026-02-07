'use client';

import { SystemStatusProvider } from './lib/SystemStatusContext';

export default function SystemBootstrap({ children }: { children: React.ReactNode }) {
  return (
    <SystemStatusProvider>
      {children}
    </SystemStatusProvider>
  );
}