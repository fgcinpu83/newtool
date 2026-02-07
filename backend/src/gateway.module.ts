// 🔒 ARCHITECTURE GATE
// Governed by: ARSITEKTUR_FINAL.md
// Role: WebSocket Gateway (ws://localhost:3001)

import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit } from '@nestjs/websockets';
import { Module, OnModuleInit, OnApplicationBootstrap } from '@nestjs/common';
import * as WebSocket from 'ws';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnApplicationBootstrap {
    // Socket.IO server instance
    @WebSocketServer()
    server: any;

    // Internal bus for components to listen to traffic
    public trafficBus: EventEmitter = new EventEmitter();
    public commandEvents: EventEmitter = new EventEmitter();

    constructor() { }

    onModuleInit() {
        console.log('Gateway initialized');
    }

    async onApplicationBootstrap() {
        console.log('Setting up Socket.IO event listeners...');
        // Socket.IO event listeners are handled via @SubscribeMessage decorators
    }

    handleConnection(client: any) {
        console.log(`[GATEWAY-3001] 📡 Socket Connected`);
    }

    handleDisconnect(client: any) {
        console.log(`[GATEWAY-3001] ❌ Socket Disconnected`);
    }

    // Socket.IO event handler for endpoint_captured
    @SubscribeMessage('endpoint_captured')
    handleEndpointCaptured(@MessageBody() data: any, @ConnectedSocket() client: any): void {
        // 🛡️ v9.6 FIX: Also unwrap nested data if present
        let actualData = data;
        if (data && data.event === 'endpoint_captured' && data.data) {
            actualData = data.data;
        }

        if (!actualData || !actualData.url) return;

        // 🛡️ v9.5 Client Identity Tagging
        // If actualData contains an account (A/B), tag this socket as an extension for that account
        if (actualData.account && (actualData.account === 'A' || actualData.account === 'B' || actualData.account === 'DESKTOP')) {
            (client as any).gravityAccount = actualData.account;
            (client as any).isExtension = true;
            (client as any).lastSeen = Date.now();
        }

        console.log(`[GATEWAY-3001] 🌊 Stream Ingest: ${actualData.url.substring(0, 50)}... [Acc: ${actualData.account || '?'}]`);

        // 🔍 DEBUG SENSOR: Log backend data reception
        console.log(`%c[DEBUG-SENSOR] 📡 BACKEND-RECEIVED: ${JSON.stringify({
            stage: 'BACKEND_RECEIVED',
            timestamp: Date.now(),
            account: actualData.account,
            provider: actualData.detectedProvider || actualData.provider,
            type: actualData.type,
            url: actualData.url?.substring(0, 100),
            dataSize: JSON.stringify(actualData).length,
            clientId: actualData.clientId
        }, null, 2)}`, 'background:#2196f3;color:#fff;font-weight:bold');

        this.trafficBus.emit('stream_data', actualData);
        this.commandEvents.emit('endpoint_captured', actualData); // 🛡️ Legacy compatibility
    }

    @SubscribeMessage('ping')
    handlePing(@ConnectedSocket() client: Socket) {
        console.log('[GATEWAY] PING FROM CLIENT', client.id);
        client.emit('pong', { ok: true, ts: Date.now() });
    }

    // Basic methods used by WorkerService - updated for Socket.IO
    sendUpdate(event: string, data: any) {
        if (!this.server) return;
        this.server.emit(event, data);
    }

    emitBrowserCommand(account: string, command: string, data: any = {}) {
        const payload = { account, command, ...data };
        this.sendUpdate('browser:command', payload);
    }
}

@Module({
    providers: [AppGateway],
    exports: [AppGateway]
})
export class GatewayModule { }