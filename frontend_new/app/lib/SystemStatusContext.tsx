'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';

interface SystemStatus {
  connected: boolean;
  ready: boolean;
  emit: (eventName: string, payload?: any) => void;
  setOnMessage: (callback: ((data: any) => void) | null) => void;
}

const SystemStatusContext = createContext<SystemStatus | undefined>(undefined);

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const SOCKET_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;

export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef<((data: any) => void) | null>(null);

  const emit = (eventName: string, payload?: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[SOCKET] Emit skipped, socket not open', eventName);
      return;
    }
    socketRef.current.send(JSON.stringify({ event: eventName, data: payload }));
  };

  const setOnMessage = (callback: ((data: any) => void) | null) => {
    onMessageRef.current = callback;
  };

  useEffect(() => {
    const socket = new WebSocket(SOCKET_URL);
    socketRef.current = socket;

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
        } else if (onMessageRef.current) {
          onMessageRef.current(data);
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
    <SystemStatusContext.Provider value={{ connected, ready, emit, setOnMessage }}>
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