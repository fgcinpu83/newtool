'use client'

import { io, Socket } from 'socket.io-client'
import type { BackendState } from '../types'

declare global {
  interface Window {
    __NEWTOOL_SOCKET__?: Socket
  }
}

type MessageHandler = (msg: BackendState) => void

const SOCKET_PATH = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

function getSocket(): Socket {
  if (typeof window === 'undefined') {
    throw new Error('Socket unavailable on server')
  }
  if (!window.__NEWTOOL_SOCKET__) {
    const s = io(SOCKET_PATH, { autoConnect: true })
    window.__NEWTOOL_SOCKET__ = s
  }
  return window.__NEWTOOL_SOCKET__ as Socket
}

export function connect(onState: MessageHandler) {
  if (typeof window === 'undefined') return
  const s = getSocket()

  // Only register once per page load
  if ((s as any).__newtool_listeners_registered) return s
  ;(s as any).__newtool_listeners_registered = true

  s.on('connect', () => {
    // no automatic behavior; let backend push full state via `backend_state`
  })

  s.on('disconnect', () => {
    // frontend must not auto-reconnect logic beyond socket.io default
  })

  s.on('backend_state', (data: unknown) => {
    try {
      onState(data as BackendState)
    } catch (e) {
      // swallow - keep UI stable
    }
  })

  return s
}

export function sendCommand(command: string, payload?: unknown) {
  if (typeof window === 'undefined') return
  const s = window.__NEWTOOL_SOCKET__
  if (!s || !s.connected) return
  s.emit('command', { type: command, payload })
}

