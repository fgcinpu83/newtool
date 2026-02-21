import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EngineService } from '../engine.service';

@WebSocketGateway()
export class AppGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly engine: EngineService) {}

  @SubscribeMessage('client_ping')
  handlePing(
    @MessageBody() payload: { account: 'A' | 'B'; ts: number },
  ) {
    this.engine.setPing(payload.account, Date.now() - payload.ts);
  }

  broadcastState() {
    this.server.emit('state_update', this.engine.getState());
  }
}