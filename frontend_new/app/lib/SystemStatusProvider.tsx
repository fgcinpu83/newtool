'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface SystemStatus {
  connected: boolean;
  ready: boolean;
  emit: (eventName: string, payload?: any) => void;
  on: (eventName: string, callback: (...args: any[]) => void) => void;
  off: (eventName: string, callback?: (...args: any[]) => void) => void;
}

const SystemStatusContext = createContext<SystemStatus | undefined>(undefined);

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const SOCKET_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;

export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const onMessageRef = useRef<((data: any) => void) | null>(null);

  const emit = (eventName: string, payload?: any) => {
    if (socketRef.current) {
      socketRef.current.emit(eventName, payload);
    }
  };

  const on = (eventName: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(eventName, callback);
    }
  };

  const off = (eventName: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(eventName, callback);
    }
  };

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('system:ready', () => {
      console.log('[SYSTEM] READY EVENT RECEIVED');
      setReady(true);
    });

    // For other messages, assume they are sent as events
    // If backend sends JSON with event, we can handle differently
    // For now, assume custom events

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('system:ready');
      socket.disconnect();
    };
  }, []);

  return (
    <SystemStatusContext.Provider value={{ connected, ready, emit, on, off }}>
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