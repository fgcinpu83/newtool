import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import * as CDP from 'chrome-remote-interface';
import axios from 'axios';

@Injectable()
export class CDPBridgeService implements OnModuleInit {
    private readonly logger = new Logger(CDPBridgeService.name);
    private activeSessions = new Map<string, any>(); // tabId -> Parent CDP Client
    private sessionMap = new Map<string, { targetId: string, url: string, account?: string }>(); // sessionId -> target info
    public events: EventEmitter = new EventEmitter(); // 🚀 Internal bus for CDP data

    async onModuleInit() {
        this.logger.log('🚀 CDP Bridge Service Initialized. Ready for Backend Bridge routing.');
    }

    private async getSession(tabId?: string, url?: string): Promise<any> {
        const key = tabId || url || 'default';
        if (this.activeSessions.has(key)) return this.activeSessions.get(key);

        try {
            const { data: targets } = await axios.get('http://localhost:9222/json');
            let target = targets.find((t: any) => {
                if (tabId) return t.id === tabId;
                if (url) return t.url.includes(url);
                return t.type === 'page';
            });

            if (!target && targets.length > 0) target = targets[0];
            if (!target) throw new Error('No valid browser target found');

            this.logger.log(`[CDP-ENGINE] 🛰️ Establishing Deep-Link to: ${target.url || target.id}`);
            const client = await CDP({ target: target.webSocketDebuggerUrl });

            // 🛠️ INSTRUKSI TEKNIS: Enable Flatten Mode for Site Isolation
            await client.Target.setAutoAttach({
                autoAttach: true,
                waitForDebuggerOnStart: false,
                flatten: true
            });

            // 🛡️ Global Network Enable
            await client.Network.enable();

            // 🛰️ Global Listener for WebSocket Frames (Cross-Origin Bypass)
            client.on('Network.webSocketFrameReceived', (params: any) => {
                const sessionId = params.sessionId || 'root';
                const payloadData = params.response.payloadData;

                // Audit Logging
                console.log(`[CDP-WIRE] 📥 Frame Received | Session: ${sessionId} | Size: ${payloadData?.length || 0}`);

                // Identify source by sessionId
                const frameInfo = this.sessionMap.get(sessionId);

                // Try JSON parse for substantive routing
                let parsedPayload = payloadData;
                const isLikelyBinary = payloadData && !payloadData.startsWith('{') && !payloadData.startsWith('[');
                if (isLikelyBinary) {
                    this.logger.debug(`[CDP-WIRE] 🧬 Suspected Binary/Base64 frame detected (Size: ${payloadData.length})`);
                }

                try {
                    if (payloadData.startsWith('{') || payloadData.startsWith('[')) {
                        parsedPayload = JSON.parse(payloadData);
                    }
                } catch (e) { }

                // Forward to substantive parser
                this.events.emit('substantive_data', {
                    type: 'cdp_frame_captured',
                    sessionId,
                    url: frameInfo?.url,
                    payload: parsedPayload,
                    timestamp: Date.now()
                });
            });

            // 🎮 Track Nested Sessions (Iframes)
            client.on('Target.attachedToTarget', async (params: any) => {
                const { sessionId, targetInfo } = params;
                this.sessionMap.set(sessionId, {
                    targetId: targetInfo.targetId,
                    url: targetInfo.url
                });
                this.logger.log(`[CDP-SESSIONS] 🖇️ Iframe Attached: ${targetInfo.url.substring(0, 50)}... (SID: ${sessionId})`);

                // 📡 Enable Network on the newly attached session
                try {
                    await client.send('Network.enable', {}, sessionId);
                } catch (e) {
                    this.logger.error(`[CDP-SESSIONS] Failed to enable Network for SID ${sessionId}: ${e.message}`);
                }
            });

            client.on('Target.detachedFromTarget', (params: any) => {
                this.sessionMap.delete(params.sessionId);
                this.logger.debug(`[CDP-SESSIONS] ✂️ Session Detached: ${params.sessionId}`);
            });

            client.on('disconnect', () => {
                this.logger.warn(`[CDP-ENGINE] ❌ Session disconnected for ${key}`);
                this.activeSessions.delete(key);
            });

            this.activeSessions.set(key, client);
            return client;
        } catch (error) {
            this.logger.error(`[CDP-ENGINE-ERROR] ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute CDP Command and route back result
     */
    async executeCommand(payload: { method: string, params: any, tabId?: string, url?: string, priority?: string }): Promise<any> {
        try {
            // ⚡ LATENCY PRIORITY: Prioritize critical updates
            if (payload.priority === 'CRITICAL_ODDS_UPDATE') {
                this.logger.log(`[CDP-PRIORITY] 🚀 High-priority execution: ${payload.method}`);
                // Move to front of event loop or handle immediately
            }

            const client = await this.getSession(payload.tabId, payload.url);
            const { method, params } = payload;

            this.logger.log(`[CDP-ROUTE] Executing ${method}`);

            const [domain, cmd] = method.split('.');
            if (!client[domain] || !client[domain][cmd]) {
                throw new Error(`Method ${method} not found in CDP client`);
            }

            const result = await client[domain][cmd](params);

            // 🔄 v3.6 STATE SYNC: Process into DB/State BEFORE returning to UI
            this.processStateSync(method, result);

            return { success: true, result };
        } catch (error) {
            this.logger.error(`[CDP-ROUTE-ERROR] ${payload.method} failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    private processStateSync(method: string, data: any) {
        // If we just got a response body, it's substantive betting data
        if (method === 'Network.getResponseBody' && data.body) {
            try {
                const parsed = JSON.parse(data.body);
                this.events.emit('substantive_data', {
                    type: 'cdp_recovered',
                    payload: parsed,
                    timestamp: Date.now()
                });
            } catch (e) {
                // Not JSON, skip
            }
        }
    }

    private routeEventToClients(event: string, data: any) {
        // Forward CDP events to the Virtual Client Bridge
        try {
            this.events.emit('cdp_event', { event, data });
        } catch (e) {
            this.logger.error(`[CDP-RELAY-ERROR] ${e.message}`);
        }
    }
}
