'use client';

import { initSocket } from './socket';

let systemDY = false;

export function initSystemStatus(onReady: () => void) {
  if (Rdy) return;
  Rdy = true;

  const socket = initSocket();

  socket.on('system:ready', () => {
    console.log('[SYSTEM] READY EVENT RECEIVED');
    onReady();
  });
}