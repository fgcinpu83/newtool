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
import { ProviderSessionManager } from './managers/provider-session.manager';
import { CommandRouterService } from './command/command-router.service';

@WebSocketGateway({ cors: true })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnApplicationBootstrap {
    // Socket.IO server instance
    @WebSocketServer()
    server: any;

    // Internal bus for components to listen to traffic
    public trafficBus: EventEmitter = new EventEmitter();
    public commandEvents: EventEmitter = new EventEmitter();

    // 🛡️ CDP ISOLATION: Track recent injected events to prevent duplication
    private recentInjectedEvents: Record<string, number> = {};

    constructor(private providerManager: ProviderSessionManager, private commandRouter: CommandRouterService) { }

    onModuleInit() {
        console.log('Gateway initialized');
        
        // Check for system readiness every 2 seconds
        const readinessCheck = setInterval(() => {
            if (this.providerManager.isSystemReady()) {
                console.log('[SYSTEM] BACKEND READY - Providers active on both accounts');
                this.server.emit('system:ready', {
                    status: 'ready',
                    ts: Date.now(),
                    systemStatus: this.providerManager.getSystemStatus()
                });
                clearInterval(readinessCheck);
            }
        }, 2000);
        
        // Fallback timeout after 30 seconds
        setTimeout(() => {
            if (!this.providerManager.isSystemReady()) {
                console.log('[SYSTEM] BACKEND READY - Timeout reached (providers may not be ready)');
                this.server.emit('system:ready', {
                    status: 'ready',
                    ts: Date.now(),
                    systemStatus: this.providerManager.getSystemStatus()
                });
                clearInterval(readinessCheck);
            }
        }, 30000);

        // --- Wire log tailer: stream new wire_debug.log lines to frontend 'system_log' (Activity Log)
        try {
            const wirePath = path.join(process.cwd(), 'logs', 'wire_debug.log');
            let lastSize = 0;
            const emitNewWireLines = () => {
                try {
                    if (!fs.existsSync(wirePath)) return;
                    const stats = fs.statSync(wirePath);
                    const size = stats.size;
                    if (size <= lastSize) return; // nothing new
                    const stream = fs.createReadStream(wirePath, { start: lastSize, end: size - 1, encoding: 'utf8' });
                    let buf = '';
                    stream.on('data', (chunk) => { buf += chunk; });
                    stream.on('end', () => {
                        lastSize = size;
                        const lines = buf.split(/\r?\n/).filter(l => l && l.trim().length > 0);
                        for (const ln of lines) {
                            try {
                                const parsed = JSON.parse(ln);
                                this.sendUpdate('system_log', { level: parsed.level || 'debug', message: parsed.message || ln, ts: parsed.ts || Date.now() });
                            } catch (e) {
                                // fallback: emit raw line
                                this.sendUpdate('system_log', { level: 'debug', message: ln, ts: Date.now() });
                            }
                        }
                    });
                    stream.on('error', () => {});
                } catch (e) { /* swallow */ }
            };
            // Poll every 2s
            setInterval(emitNewWireLines, 2000);
        } catch (e) { console.error('[GATEWAY] Wire log tailer failed to start', e); }
    }

    async onApplicationBootstrap() {
        console.log('Setting up Socket.IO event listeners...');
        // Socket.IO event listeners are handled via @SubscribeMessage decorators
        // Also attach an HTTP request listener to capture Engine.IO polling GET requests
        try {
            // `this.server` is the Socket.IO server; it exposes the underlying http server
            const httpServer = (this.server && (this.server as any).httpServer) ? (this.server as any).httpServer : null;
            if (httpServer && httpServer.on) {
                httpServer.on('request', (req: any, res: any) => {
                    try {
                        const url = req && req.url ? String(req.url) : '';
                        const method = req && req.method ? String(req.method) : '';
                        if (method === 'GET' && url.indexOf('/socket.io/') === 0) {
                            const wire = path.join(process.cwd(), 'logs', 'wire_debug.log');
                            const entry = {
                                ts: Date.now(),
                                event: 'socket_polling_request',
                                method,
                                url,
                                remoteAddress: req && req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : null,
                                pid: process.pid
                            };
                            try { fs.appendFileSync(wire, JSON.stringify(entry) + '\n'); } catch (e) { /* non-fatal */ }
                        }
                    } catch (e) {
                        // swallow to avoid breaking server request handling
                    }
                });
            }
        } catch (e) {
            console.error('[GATEWAY] failed to attach http request logger', e);
        }
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
            // Append to wire debug log for correlation with toggle events
            const wire = path.join(process.cwd(), 'logs', 'wire_debug.log');
            try {
                fs.appendFileSync(wire, JSON.stringify({ ts, event: 'socket_disconnect', clientId: id, account: acc }) + '\n');
            } catch (e) {
                console.error('[GATEWAY] Failed to append disconnect to wire log', e);
            }
        } catch (e) {
            console.log('[GATEWAY-3001] ❌ Socket Disconnected (logging failed)');
        }
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

        // 🛡️ CDP ISOLATION: Prevent duplication between injected and CDP events
        const eventSource = actualData.source;
        const eventUrl = actualData.url;
        const now = Date.now();

        if (eventSource === 'cdp') {
            // Check if there's a recent injected event for this URL (within 5 seconds)
            const lastInjected = this.recentInjectedEvents[eventUrl];
            if (lastInjected && (now - lastInjected) < 5000) {
                console.log(`[GATEWAY-3001] 🚫 CDP event IGNORED (duplicate of recent injected): ${eventUrl.substring(0, 50)}...`);
                return; // Ignore this CDP event
            }
        } else if (eventSource === 'injected') {
            // Track injected events for deduplication
            this.recentInjectedEvents[eventUrl] = now;
            // Clean up old entries (older than 10 seconds)
            for (const url in this.recentInjectedEvents) {
                if (now - this.recentInjectedEvents[url] > 10000) {
                    delete this.recentInjectedEvents[url];
                }
            }
        }

        // 🛡️ v9.5 Client Identity Tagging
        // If actualData contains an account (A/B), tag this socket as an extension for that account
        if (actualData.account && (actualData.account === 'A' || actualData.account === 'B' || actualData.account === 'DESKTOP')) {
            (client as any).gravityAccount = actualData.account;
            (client as any).isExtension = true;
            (client as any).lastSeen = Date.now();
        }

        console.log(`[GATEWAY-3001] 🌊 Stream Ingest: ${actualData.url.substring(0, 50)}... [Acc: ${actualData.account || '?'}] [Source: ${eventSource || 'unknown'}]`);

        // 🔍 DEBUG SENSOR: Log backend data reception
        console.log(`%c[DEBUG-SENSOR] 📡 BACKEND-RECEIVED: ${JSON.stringify({
            stage: 'BACKEND_RECEIVED',
            timestamp: Date.now(),
            account: actualData.account,
            provider: actualData.detectedProvider || actualData.provider,
            type: actualData.type,
            url: actualData.url?.substring(0, 100),
            dataSize: JSON.stringify(actualData).length,
            clientId: actualData.clientId,
            source: eventSource
        }, null, 2)}`, 'background:#2196f3;color:#fff;font-weight:bold');

        this.trafficBus.emit('stream_data', actualData);
        this.commandEvents.emit('endpoint_captured', actualData); // 🛡️ Legacy compatibility
    }

    @SubscribeMessage('ping')
    handlePing(@ConnectedSocket() client: Socket) {
        console.log('[GATEWAY] PING FROM CLIENT', client.id);
        client.emit('pong', { ok: true, ts: Date.now() });
    }

    // Receive generic commands from frontend and forward to internal listeners
    @SubscribeMessage('command')
    handleCommand(@MessageBody() data: any, @ConnectedSocket() client: any) {
        // normalize payload shape
        const cmd = data && data.type ? data : (data && data.command ? { type: data.command, payload: data.payload } : null)
        if (!cmd) return;
        console.log(`[GATEWAY] ← command: ${cmd.type}`);
        // Attach client identity if present
        if (client && (client as any).gravityAccount) cmd.originAccount = (client as any).gravityAccount
        // Route to CommandRouterService (business logic lives there)
        try {
            this.commandRouter.route(cmd)
        } catch (e) { 
            console.error('[GATEWAY] Command routing failed', e)
            try { const fs = require('fs'); const p = require('path'); fs.appendFileSync(p.join(process.cwd(),'logs','wire_debug.log'), JSON.stringify({ ts: Date.now(), event: 'GATEWAY_COMMAND_ERROR', command: cmd && cmd.type, error: e && e.message ? e.message : String(e) }) + '\n'); } catch(err){}
        }
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
    imports: [],
    providers: [AppGateway, CommandRouterService],
    exports: [AppGateway, CommandRouterService]
})
export class GatewayModule { }