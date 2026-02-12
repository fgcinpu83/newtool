import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function connect(onMessage: (data: any) => void) {
  if (socket) return

  socket = io('http://localhost:3001')

  socket.on('connect', () => {
    console.log('Connected to backend')
  })

  socket.on('disconnect', () => {
    console.log('Disconnected from backend')
  })

  socket.on('system_status', (data) => {
    onMessage(data)
  })

  socket.on('fsm:transition', (data) => {
    onMessage(data)
  })

  socket.on('pipeline:readiness', (data) => {
    onMessage(data)
  })

  socket.on('live_feed', (data) => {
    onMessage(data)
  })

  socket.on('execution_history', (data) => {
    onMessage(data)
  })

  socket.on('system_log', (data) => {
    onMessage(data)
  })
}

export function sendCommand(command: string, payload?: any) {
  if (!socket) return
  socket.emit('command', { type: command, payload })
}