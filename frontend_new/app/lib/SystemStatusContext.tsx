'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SystemStatus {
  connected: boolean;
  ready: boolean;
}

const SystemStatusContext = createContext<SystemStatus | undefined>(undefined);

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const SOCKET_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;

export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(SOCKET_URL);

    socket.onopen = () => {
      setConnected(true);
    };

    socket.onclose = () => {
      setConnected(false);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'system:ready') {
          console.log('[SYSTEM] READY EVENT RECEIVED');
          setReady(true);
        }
      } catch (err) {
        // ignore
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <SystemStatusContext.Provider value={{ connected, ready }}>
      {children}
    </SystemStatusContext.Provider>
  );
}

export function useSystemStatus() {
  const context = useContext(SystemStatusContext);
  if (context === undefined) {
    throw new Error('useSystemStatus must be used within a SystemStatusProvider');
  }
  return context;
}