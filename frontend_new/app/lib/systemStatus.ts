'use client';

import { initSocket } from './socket';

let initialized = false;

export function initSystemStatus(onReady: () => void) {
  if (initialized) return;
  initialized = true;

  const socket = initSocket();

  socket.on('system:ready', () => {
    console.log('[SYSTEM] READY EVENT RECEIVED');
    onReady();
  });
}