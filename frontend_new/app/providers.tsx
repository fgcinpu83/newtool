'use client';

import { SystemStatusProvider } from './lib/SystemStatusProvider';

export default function SystemBootstrap({ children }: { children: React.ReactNode }) {
  return (
    <SystemStatusProvider>
      {children}
    </SystemStatusProvider>
  );
}