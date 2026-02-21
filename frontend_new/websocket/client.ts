'use client'

import { io, Socket } from 'socket.io-client'
import type { BackendState } from '../types'

declare global {
  interface Window {
    __NEWTOOL_SOCKET__?: Socket
  }
}

type MessageHandler = (msg: BackendState) => void

// WebSocket host (gateway) and REST base (backend service)
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:3001'
const REST_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:3001'

function getSocket(): Socket {
  if (typeof window === 'undefined') {
    throw new Error('Socket unavailable on server')
  }
  if (!window.__NEWTOOL_SOCKET__) {
    const s = io(WS_URL, { autoConnect: true })
    window.__NEWTOOL_SOCKET__ = s
  }
  return window.__NEWTOOL_SOCKET__ as Socket
}

let onStateCallback: MessageHandler | null = null

export function connect(onState: MessageHandler) {
  if (typeof window === 'undefined') return
  const s = getSocket()

  // Only register once per page load
  if ((s as any).__newtool_listeners_registered) return s
  ;(s as any).__newtool_listeners_registered = true

  s.on('connect', () => {
    // Request immediate status snapshot on connect
    try {
      s.emit('command', { type: 'GET_STATUS' })
    } catch (e) { }
  })

  s.on('disconnect', () => {
    // frontend must not auto-reconnect logic beyond socket.io default
  })

  s.on('backend_state', (data: unknown) => {
    try {
      onState(data as BackendState)
      onStateCallback = onState
    } catch (e) {
      // swallow - keep UI stable
    }
  })

  // Forward UI-level config events to backend as socket commands
  if (typeof window !== 'undefined') {
    window.addEventListener('app:apply-config', (ev: any) => {
      try {
        const cfg = ev?.detail
        if (cfg) s.emit('command', { type: 'UPDATE_CONFIG', payload: cfg })
      } catch (e) { }
    })

    // Optional debug telemetry channel from UI -> backend
    window.addEventListener('app:log-opps', (ev: any) => {
      try {
        const payload = ev?.detail
        if (payload) s.emit('command', { type: 'LOG_OPPS', payload })
      } catch (e) { }
    })
  }

  return s
}

export function sendCommand(command: string, payload?: unknown) {
  if (typeof window === 'undefined') return
  const s = window.__NEWTOOL_SOCKET__
  if (!s || !s.connected) return
  s.emit('command', { type: command, payload })
}

export async function toggleAccount(accountId: 'A' | 'B', active: boolean) {
  await fetch(REST_BASE + '/api/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: accountId, active })
  })

  // refresh backend snapshot and notify UI
  try {
    const res = await fetch(REST_BASE + '/api/backend-state')
    const state = await res.json()
    if (onStateCallback) onStateCallback(state as BackendState)
  } catch (e) {
    // ignore
  }
}

export async function setUrl(accountId: 'A' | 'B', url: string) {
  await fetch(REST_BASE + '/api/set-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: accountId, url })
  })

  // refresh backend snapshot and notify UI
  try {
    const res = await fetch(REST_BASE + '/api/backend-state')
    const state = await res.json()
    if (onStateCallback) onStateCallback(state as BackendState)
  } catch (e) {
    // ignore
  }
}

