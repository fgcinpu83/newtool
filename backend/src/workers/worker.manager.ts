// 🔒 ARCHITECTURE GATE
// Governed by: ARSITEKTUR_FINAL.md
// Role: Stream Orchestrator (Spawn/Route to Workers)

import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppGateway } from '../gateway.module';
import { ContractRegistry } from './contract-registry.service';
import { AfbWorker } from './afb.worker';
import { CmdWorker } from './cmd.worker';
import { UniversalDecoderService } from '../shared/decoder.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WorkerManager implements OnModuleInit {
    constructor(
        private gateway: AppGateway,
        private contracts: ContractRegistry,
        private afbWorker: AfbWorker,
        private cmdWorker: CmdWorker,
        private decoder: UniversalDecoderService
    ) {
        console.log("[WORKER-MANAGER] 🏗️ Hard Constructor call");
        try { fs.appendFileSync(path.join(process.cwd(), 'logs', 'wire_debug.log'), `[${new Date().toISOString()}] [WORKER-MANAGER] 🏗️ Hard Constructor call\n`); } catch (e) { }
    }

    onModuleInit() {
        const initMsg = "[WORKER-MANAGER] ⚙️ Orchestrator v3.1 Online.\n";
        console.log(initMsg);
        try { fs.appendFileSync(path.join(process.cwd(), 'logs', 'wire_debug.log'), `[${new Date().toISOString()}] ${initMsg}`); } catch (e) { }

        this.gateway.trafficBus.on('stream_data', (packet) => {
            // 🚀 NON-BLOCKING FORK: Launch router without awaiting
            // This ensures Provider A doesn't wait for Provider B's processing
            (async () => {
                const payload = packet.payload || packet.data || packet;
                await this.routePacket(packet.url, payload, packet.account);
            })().catch(err => console.error(`[ROUTER-ERROR] ${err.message}`));
        });

        // CDP Bridge removed - CDP operations must go through ChromeConnectionManager
    }

    private async routePacket(url: string, payload: any, account: string) {
        // 🚀 TAHAP 2: Universal Payload Decoding (Protobuf/Base64/Socket.io)
        const decodedPayload = await this.decoder.decode(payload);

        // 1. Identification
        const identity = this.contracts.identify(url, decodedPayload);
        const logMsg = `[DEBUG-MM] Identify result for ${url}: ${identity ? identity.provider : 'NONE'}\n`;
        console.log(logMsg);
        try { fs.appendFileSync(path.join(process.cwd(), 'logs', 'wire_debug.log'), `[${new Date().toISOString()}] ${logMsg}`); } catch (e) { }

        if (identity) {
            // 2. Routing
            console.log(`[WORKER-MANAGER] 🐣 Routing to ${identity.provider} Worker (Account: ${account}) | Substantive: ${!!decodedPayload}`);

            if (identity.provider === 'AFB88') {
                this.afbWorker.process(account, decodedPayload);
            } else if (identity.provider === 'CMD368' || identity.provider === 'ISPORT' || identity.provider === 'SABA') {
                this.cmdWorker.process(account, decodedPayload);
            }
        } else if (decodedPayload) {
            // 🛡️ v4.0 AUTO-DISCOVERY: Check if unknown data looks like match odds
            const { confidence, reason } = this.decoder.getMatchDataConfidence(decodedPayload);
            const discMsg = `[DEBUG-MM] Discovery confidence for ${url}: ${confidence} (${reason})\n`;
            console.log(discMsg);
            try { fs.appendFileSync(path.join(process.cwd(), 'logs', 'wire_debug.log'), `[${new Date().toISOString()}] ${discMsg}`); } catch (e) { }

            if (confidence >= 70) {
                console.log(`%c[WORKER-MANAGER] 🕵️ UNKNOWN DATA DETECTED (Confidence: ${confidence}% | ${reason})`, 'background:#f44336;color:#fff;font-weight:bold');
                console.log(`[WORKER-MANAGER] 🔗 URL: ${url.substring(0, 100)}`);

                this.gateway.sendUpdate('UNKNOWN_PROVIDER_DATA', {
                    url: url,
                    account: account,
                    confidence: confidence,
                    reason: reason,
                    sample: typeof decodedPayload === 'object' ?
                        JSON.stringify(decodedPayload).substring(0, 500) :
                        String(decodedPayload).substring(0, 500),
                    timestamp: Date.now()
                });
            }
        }
    }
}
