import { io, Socket } from 'socket.io-client';

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const SOCKET_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;

let socketInstance: Socket | null = null;

export function initSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL);
  }
  return socketInstance;
}