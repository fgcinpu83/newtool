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
    const latency = Date.now() - payload.ts;
    this.engine.setPing(payload.account, latency);
    this.server.emit('backend_state', this.engine.getState());
  }

  @SubscribeMessage('PROVIDER_MARKED')
  handleProviderMarked(
    @MessageBody() payload: { account: 'A' | 'B'; providerId: string },
  ) {
    this.engine.markProvider(payload.account, payload.providerId);
    this.broadcastState();
  }

  @SubscribeMessage('STREAM_DETECTED')
  handleStream(
    @MessageBody() payload: { account: 'A' | 'B' },
  ) {
    this.engine.handleStreamDetected(payload.account);
    this.server.emit('backend_state', this.engine.getState());
  }

  // alias to avoid silent failures if clients emit alternate name
  @SubscribeMessage('STREAM_PACKET')
  handleStreamAlias(
    @MessageBody() payload: { account: 'A' | 'B' },
  ) {
    // reuse existing logic exactly
    return this.handleStream(payload as any);
  }

  broadcastState() {
    const st = this.engine.getState();
    // frontend only expects `backend_state`
    this.server.emit('backend_state', st);
  }
}