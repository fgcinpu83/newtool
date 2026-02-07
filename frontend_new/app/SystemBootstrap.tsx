'use client';

import { useEffect } from 'react';
import { initSystemStatus } from './lib/systemStatus';

export default function SystemBootstrap() {
  useEffect(() => {
    initSystemStatus(() => {
      document.body.setAttribute('data-system', 'ready');
    });
  }, []);

  return null;
}