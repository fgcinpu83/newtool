// 🔒 ARCHITECTURE GATE
// Governed by: ARSITEKTUR_FINAL.md
// Role: WebSocket Gateway (ws://localhost:3001)

import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Module, OnModuleInit } from '@nestjs/common';
import { Socket } from 'socket.io';
import { EngineService } from './engine.service';
import { WorkerModule } from './workers/worker.module';
import { BrowserAutomationService } from './workers/browser.automation';
import { ChromeLauncher } from './chrome/chrome-launcher.service';
import { ChromeConnectionManager } from './managers/chrome-connection.manager';

@WebSocketGateway({ cors: true })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
    // Socket.IO server instance
    @WebSocketServer()
    server: any;

    // (minimal gateway: no internal event buses)

    constructor(private engine: EngineService) { }

    onModuleInit() {
        console.log('Gateway initialized');
        
        // Minimal readiness: report ready with engine state
        setTimeout(() => {
            console.log('[SYSTEM] BACKEND READY - minimal mode');
            this.server && this.server.emit && this.server.emit('system:ready', {
                status: 'ready',
                ts: Date.now(),
                systemStatus: { accounts: this.engine.getState() }
            });
        }, 1000);

    }


    handleConnection(client: any) {
        console.log(`[GATEWAY-3001] 📡 Socket Connected`);
    }

    handleDisconnect(client: any) {
        try {
            const id = client && client.id ? client.id : 'unknown';
            const acc = (client && (client as any).gravityAccount) ? (client as any).gravityAccount : '?';
            const ts = Date.now();
            console.log(`[GATEWAY-3001] ❌ Socket Disconnected: id=${id} account=${acc} ts=${new Date(ts).toISOString()}`);
        } catch (e) {
            console.log('[GATEWAY-3001] ❌ Socket Disconnected (logging failed)');
        }
    }


    @SubscribeMessage('client_ping')
    handlePing(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
        try {
            // determine ping
            let measured: number | null = null;
            if (data && typeof data.ping === 'number') measured = Number(data.ping);
            else if (data && typeof data.ts === 'number') measured = Date.now() - Number(data.ts);

            const acc = (client && (client as any).gravityAccount) ? (client as any).gravityAccount : null;
            if (acc === 'A' || acc === 'B') {
                try { this.engine.setPing(acc as 'A'|'B', measured); } catch (e) { }
                this.sendUpdate('state_update', { accounts: this.engine.getState() });
            }

            client.emit('pong', { ok: true, ts: Date.now(), ping: measured });
        } catch (e) {
            console.error('[GATEWAY] handlePing failed', e);
        }
    }


    // Basic methods used by WorkerService - updated for Socket.IO
    sendUpdate(event: string, data: any) {
        // Only state_update allowed in minimal mode
        if (event !== 'state_update') return;
        const IS_CI = process.env.CI === 'true' || process.env.NODE_ENV === 'test';
        if (IS_CI) {
            // no-op in CI
            return;
        }
        if (!this.server) return;
        this.server.emit(event, data);
    }


}

@Module({
    imports: [WorkerModule],
    providers: [AppGateway, EngineService, BrowserAutomationService, ChromeLauncher, ChromeConnectionManager],
    exports: [AppGateway, EngineService, BrowserAutomationService]
})
export class GatewayModule { }