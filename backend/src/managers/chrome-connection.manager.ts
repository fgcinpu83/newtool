/**
 * ChromeConnectionManager v3.1 - CONSTITUTION COMPLIANT
 *
 * SYSTEM CONSTITUTION §III.1:
 * - Satu-satunya pintu Chrome
 * - State machine: DISCONNECTED → CONNECTING → CONNECTED / ERROR
 * - attach() idempotent
 * - Tidak boleh attach jika CONNECTING/CONNECTED
 * - Semua file chrome dilarang buat koneksi sendiri
 *
 * v3.1: attach() now calls ChromeLauncher.ensureRunning() BEFORE
 *       probing CDP — Chrome is started automatically if not running.
 *
 * INVARIANTS:
 * 1. State NEVER goes backwards without explicit detach()
 * 2. Only ONE attach per port at any time
 * 3. All Chrome HTTP/WS access MUST go through this manager
 * 4. ChromeLauncher is the ONLY way Chrome processes are spawned
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ChromeLauncher } from '../chrome/chrome-launcher.service';
import * as fs from 'fs';
import * as path from 'path';

// ─── State Machine ───────────────────────────────────
export type ChromeConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

// Allowed transitions (from → to[])
const ALLOWED_TRANSITIONS: Record<ChromeConnectionState, ChromeConnectionState[]> = {
    DISCONNECTED: ['CONNECTING'],
    CONNECTING:   ['CONNECTED', 'ERROR', 'DISCONNECTED'],
    CONNECTED:    ['DISCONNECTED', 'ERROR'],
    ERROR:        ['DISCONNECTED', 'CONNECTING'],
};

// ─── Per-port info ───────────────────────────────────
export interface ChromeConnectionInfo {
    port: number;
    state: ChromeConnectionState;
    tabs: number;
    lastChecked: number;
    errorMessage?: string;
    attachedAt?: number;
}

@Injectable()
export class ChromeConnectionManager {
    private readonly logger = new Logger(ChromeConnectionManager.name);

    // One entry per account port
    private readonly ports: Map<number, ChromeConnectionInfo> = new Map();

    constructor(
        @Inject(forwardRef(() => ChromeLauncher))
        private readonly launcher: ChromeLauncher,
    ) {
        for (const port of [9222, 9223]) {
            this.ports.set(port, {
                port,
                state: 'DISCONNECTED',
                tabs: 0,
                lastChecked: 0,
            });
        }
        this.logger.log('ChromeConnectionManager v3.1 initialized (ports 9222, 9223)');
    }

    // ─── STATE MACHINE CORE ─────────────────────────

    /**
     * Transition state with validation.
     * THROWS if transition is illegal.
     */
    private transition(port: number, to: ChromeConnectionState, extra?: Partial<ChromeConnectionInfo>): void {
        const info = this.ports.get(port);
        if (!info) throw new Error(`Unknown port: ${port}`);

        const from = info.state;
        if (from === to) return; // noop

        if (!ALLOWED_TRANSITIONS[from].includes(to)) {
            const msg = `Illegal transition ${from} → ${to} on port ${port}`;
            this.logger.error(msg);
            throw new Error(msg);
        }

        this.ports.set(port, { ...info, ...extra, state: to });
        this.logger.log(`[${port}] ${from} → ${to}`);
    }

    // ─── PUBLIC API ─────────────────────────────────

    /**
     * Attach to Chrome CDP on specified port.
     *
     * IDEMPOTENT per Constitution §III.1:
     * - CONNECTING / CONNECTED → return current state (no-op)
     * - DISCONNECTED / ERROR   → attempt connection
     */
    async attach(port: number): Promise<ChromeConnectionInfo> {
        const info = this.getInfo(port);

        // Idempotent: already connected or connecting → return
        if (info.state === 'CONNECTED' || info.state === 'CONNECTING') {
            this.logger.log(`[${port}] attach() idempotent — already ${info.state}`);
            this.logger.log(`[OBSERVE] Chrome connection stable - port ${port} already ${info.state}`);
            return info;
        }

        // Transition: DISCONNECTED/ERROR → CONNECTING
        this.transition(port, 'CONNECTING');
        this.logger.log(`[OBSERVE] Chrome connection attempt - port ${port} transitioning to CONNECTING`);

        try {
            // STEP 3.1: Ensure Chrome process is running before probing CDP
            const launchResult = await this.launcher.ensureRunning(port);
            // Diagnostic: record exact launcher decision so we can correlate host probes with attach failures.
            try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'LAUNCHER_RESULT', port, launchResult }) + '\n'); } catch (e) { /* swallow */ }
            this.logger.debug(`[${port}] launcher.ensureRunning -> ${JSON.stringify(launchResult)}`);
            if (!launchResult.launched && !launchResult.reused) {
                throw new Error(`Chrome launch failed: ${launchResult.message}`);
            }

            // CI / test short-circuit: don't attempt HTTP probing in CI/test — simulate CONNECTED
            const IS_CI = process.env.CI === 'true';
            const IS_TEST = process.env.NODE_ENV === 'test';
            if (IS_CI || IS_TEST) {
                this.transition(port, 'CONNECTED', {
                    tabs: 0,
                    lastChecked: Date.now(),
                    attachedAt: Date.now(),
                    errorMessage: undefined,
                });
                this.logger.log(`[OBSERVE] Chrome connection simulated for CI/test on port ${port}`);
                return this.getInfo(port);
            }

            // For port 9223 (Account B) prefer host bridge with Host rewrite unconditionally.
            // This avoids host-proxy Host header rejections observed when contacting
            // host.docker.internal without rewriting Host to 127.0.0.1:9223.
            let response: any = null;
            const hostHeaders = port === 9223 ? { Host: `localhost:${port}` } as any : { Host: `127.0.0.1:${port}` } as any;
            if (port === 9223) {
                // Use a raw HTTP HEAD request for /json/version on port 9223 and set Host: localhost:9223.
                // node-fetch GETs have been observed returning 500 from the host proxy while HEAD succeeds,
                // so prefer HEAD here (we only need status to determine responsiveness).
                try {
                    this.logger.log(`[${port}] PROBE: HEAD http://host.docker.internal:${port}/json/version (Host: localhost:${port})`);
                    const http = require('http');
                    const opts: any = { method: 'HEAD', host: 'host.docker.internal', port, path: '/json/version', headers: { Host: `localhost:${port}` }, timeout: 3000 };
                    response = await new Promise<any>((resolve, reject) => {
                        const req = http.request(opts, (res: any) => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode }));
                        req.on('error', (err: any) => reject(err));
                        req.on('timeout', () => { try { req.destroy(); } catch (e) {} reject(new Error('timeout')); });
                        req.end();
                    });
                    try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'ATTACH_HEAD_RESPONSE', port, status: response && response.status }) + '\n'); } catch (e) { /* swallow */ }
                    this.logger.log(`[${port}] PROBE-HOST (HEAD) result: status=${response && response.status}`);
                    if (!response || !response.ok) throw new Error(`HTTP ${response ? response.status : 'no-response'}`);
                } catch (eHost) {
                    throw new Error(`HTTP HEAD probe failed host.docker.internal for port ${port}: ${String(eHost)}`);
                }
            } else {
                try {
                    this.logger.log(`[${port}] PROBE: GET http://localhost:${port}/json/version`);
                    response = await fetch(`http://localhost:${port}/json/version`, { signal: AbortSignal.timeout(3000) });
                    if (response) {
                        try {
                            const headers = JSON.stringify(Array.from((response.headers as any).entries()));
                            const text = await response.text().catch(() => '<no-body>');
                            this.logger.log(`[${port}] PROBE-LOCAL RESPONSE: status=${response.status} headers=${headers} body=${text.substring(0,2000)}`);
                        } catch (e) {
                            this.logger.log(`[${port}] PROBE-LOCAL: failed reading response details: ${(e && (e as Error).message) || String(e)}`);
                        }
                    }
                } catch (eLocal) {
                    try {
                    this.logger.log(`[${port}] PROBE: localhost failed (${(eLocal && (eLocal as Error).message) || String(eLocal)}), trying host.docker.internal with Host rewrite`);
                    this.logger.log(`[${port}] PROBE: GET http://host.docker.internal:${port}/json/version (Host: localhost:${port})`);
                    response = await fetch(`http://host.docker.internal:${port}/json/version`, { signal: AbortSignal.timeout(3000), headers: hostHeaders });
                        if (response) {
                            try {
                                const headers = JSON.stringify(Array.from((response.headers as any).entries()));
                                const text = await response.text().catch(() => '<no-body>');
                                this.logger.log(`[${port}] PROBE-HOST RESPONSE: status=${response.status} headers=${headers} body=${text.substring(0,2000)}`);
                            } catch (e) {
                                this.logger.log(`[${port}] PROBE-HOST: failed reading response details: ${(e && (e as Error).message) || String(e)}`);
                            }
                        }
                    } catch (eHost) {
                        throw new Error(`HTTP probe failed localhost and host.docker.internal: ${String(eHost)}`);
                    }
                }
            }

            if (!response || !response.ok) {
                throw new Error(`HTTP ${response ? response.status : 'no-response'}`);
            }

            // Count tabs
            const tabs = await this.fetchTabCount(port);

            this.transition(port, 'CONNECTED', {
                tabs,
                lastChecked: Date.now(),
                attachedAt: Date.now(),
                errorMessage: undefined,
            });

            this.logger.log(`[OBSERVE] Chrome connection successful - port ${port} connected with ${tabs} tabs`);
            return this.getInfo(port);
        } catch (err: any) {
            this.transition(port, 'ERROR', {
                errorMessage: err.message,
                lastChecked: Date.now(),
                attachedAt: undefined,
            });
            this.logger.log(`[OBSERVE] Chrome connection failed - port ${port} error: ${err.message}`);
            return this.getInfo(port);
        }
    }

    /**
     * Detach from Chrome on specified port.
     * Always resets to DISCONNECTED regardless of current state.
     */
    detach(port: number): void {
        const info = this.ports.get(port);
        if (!info) return;

        // Force reset to clean DISCONNECTED
        this.ports.set(port, {
            port,
            state: 'DISCONNECTED',
            tabs: 0,
            lastChecked: Date.now(),
            errorMessage: undefined,
            attachedAt: undefined,
        });
        this.logger.log(`[${port}] detached → DISCONNECTED`);
    }

    /**
     * Detach all ports (shutdown cleanup).
     */
    detachAll(): void {
        for (const port of this.ports.keys()) {
            this.detach(port);
        }
    }

    // ─── READ-ONLY QUERIES (no side effects) ────────

    /** Get state for port. Throws if unknown port. */
    getInfo(port: number): ChromeConnectionInfo {
        const info = this.ports.get(port);
        if (!info) throw new Error(`Unknown port: ${port}`);
        return { ...info }; // return copy
    }

    /** Get state for account. */
    getInfoForAccount(account: 'A' | 'B'): ChromeConnectionInfo {
        return this.getInfo(ChromeConnectionManager.portFor(account));
    }

    /** Get all connection states (copy). */
    getAllStates(): Record<number, ChromeConnectionInfo> {
        const result: Record<number, ChromeConnectionInfo> = {};
        for (const [port, info] of this.ports) {
            result[port] = { ...info };
        }
        return result;
    }

    /** Is the port in CONNECTED state? */
    isConnected(port: number): boolean {
        return this.ports.get(port)?.state === 'CONNECTED';
    }

    /** Is the port in CONNECTED state for account? */
    isAccountConnected(account: 'A' | 'B'): boolean {
        return this.isConnected(ChromeConnectionManager.portFor(account));
    }

    // ─── CHROME HTTP HELPERS (delegated access) ─────
    // All chrome HTTP calls go through here so no other file touches Chrome directly.

    /** Fetch list of page tabs from Chrome. Requires CONNECTED state. */
    async getTabs(port: number): Promise<{ id: string; title: string; url: string; type: string; webSocketDebuggerUrl?: string }[]> {
        this.assertConnected(port);

        // CI / test: return empty quickly (no real Chrome present)
        const IS_CI = process.env.CI === 'true';
        const IS_TEST = process.env.NODE_ENV === 'test';
        if (IS_CI || IS_TEST) return [];

        try {
            const hostHeaders = { Host: `127.0.0.1:${port}` } as any;
            let res: any = null;
            if (port === 9223) {
                this.logger.log(`[${port}] getTabs: forcing host.docker.internal with Host rewrite for /json`);
                res = await fetch(`http://host.docker.internal:${port}/json`, { signal: AbortSignal.timeout(3000), headers: hostHeaders });
            } else {
                res = await fetch(`http://localhost:${port}/json`, { signal: AbortSignal.timeout(3000) });
                if (!res || !res.ok) {
                    this.logger.log(`[${port}] getTabs: falling back to host.docker.internal with Host rewrite`);
                    res = await fetch(`http://host.docker.internal:${port}/json`, { signal: AbortSignal.timeout(3000), headers: hostHeaders });
                }
            }
            if (!res || !res.ok) return [];
            const all = await res.json();
            const pages = all.filter((t: any) => t.type === 'page');
            // Rewrite any webSocketDebuggerUrl hosts so container can connect via host.docker.internal
            const rewritten = pages.map((p: any) => {
                if (p.webSocketDebuggerUrl && typeof p.webSocketDebuggerUrl === 'string') {
                    p.webSocketDebuggerUrl = this.rewriteWsHost(p.webSocketDebuggerUrl, port);
                }
                return p;
            });
            // Update tab count
            const info = this.ports.get(port)!;
            this.ports.set(port, { ...info, tabs: rewritten.length, lastChecked: Date.now() });
            return rewritten;
        } catch {
            return [];
        }
    }

    /** Open a new tab. Requires CONNECTED state. Implements HTTP + CDP fallback. */
    async openTab(port: number, url: string): Promise<any | null> {
        this.assertConnected(port);
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        // Primary attempt: use /json/new (HTTP). Many environments support this.
        const endpointLocal = `http://localhost:${port}/json/new?url=${encodeURIComponent(fullUrl)}`;
        const endpointHost = `http://host.docker.internal:${port}/json/new?url=${encodeURIComponent(fullUrl)}`;
        const hostHeaders = port === 9223 ? { Host: `localhost:${port}` } as any : { Host: `127.0.0.1:${port}` } as any;

        try {
            if (port === 9223) {
                // Force host bridge for port 9223 — use raw http.request (PUT) because node-fetch GET/PUT to host.docker.internal with Host header is rejected by the host proxy in some environments.
                this.logger.log(`[${port}] openTab: forcing host.docker.internal PUT (raw http) ${endpointHost} with Host: localhost:${port}`);
                let resStatus: number | null = null;
                let resBody: string | null = null;
                try {
                    const http = require('http');
                    const urlObj = new URL(endpointHost);
                    const opts: any = { method: 'PUT', host: urlObj.hostname, port: urlObj.port || 80, path: urlObj.pathname + (urlObj.search || ''), headers: Object.assign({ Host: `localhost:${port}` }, {}), timeout: 5000 };
                    resStatus = await new Promise<number>((resolve, reject) => {
                        const req = http.request(opts, (r: any) => {
                            let chunks: any[] = [];
                            r.on('data', (c: any) => chunks.push(Buffer.from(c)));
                            r.on('end', () => {
                                try { resBody = Buffer.concat(chunks).toString('utf8'); } catch (e) { resBody = '<body-read-failed>'; }
                                resolve(r.statusCode || 0);
                            });
                        });
                        req.on('error', (err: any) => reject(err));
                        req.on('timeout', () => { try { req.destroy(); } catch (e) {} reject(new Error('timeout')); });
                        req.end();
                    });
                } catch (e) {
                    this.logger.log(`[${port}] openTab: raw host.docker.internal PUT threw: ${(e && (e as Error).message) || String(e)}`);
                }

                this.logger.log(`[${port}] openTab: HTTP response status=${resStatus} body=${(resBody || '').substring(0,2000)}`);
                if (resStatus && resStatus >= 200 && resStatus < 400) {
                    try {
                        const parsed = JSON.parse(resBody || '{}');
                        if (parsed && typeof parsed === 'object' && parsed.webSocketDebuggerUrl) parsed.webSocketDebuggerUrl = this.rewriteWsHost(parsed.webSocketDebuggerUrl, port);
                        return parsed;
                    } catch (e) {
                        return resBody;
                    }
                }

                // If PUT failed, try GET fallback using raw http as well
                try {
                    const http = require('http');
                    const urlObj = new URL(endpointHost);
                    const opts: any = { method: 'GET', host: urlObj.hostname, port: urlObj.port || 80, path: urlObj.pathname + (urlObj.search || ''), headers: Object.assign({ Host: `localhost:${port}` }, {}), timeout: 5000 };
                    let getStatus = await new Promise<number>((resolve, reject) => {
                        const req = http.request(opts, (r: any) => {
                            let chunks: any[] = [];
                            r.on('data', (c: any) => chunks.push(Buffer.from(c)));
                            r.on('end', () => { try { resBody = Buffer.concat(chunks).toString('utf8'); } catch (e) { resBody = '<body-read-failed>'; } resolve(r.statusCode || 0); });
                        });
                        req.on('error', (err: any) => reject(err));
                        req.on('timeout', () => { try { req.destroy(); } catch (e) {} reject(new Error('timeout')); });
                        req.end();
                    });
                    this.logger.log(`[${port}] openTab: GET fallback status=${getStatus} body=${(resBody || '').substring(0,2000)}`);
                    if (getStatus >= 200 && getStatus < 400) {
                        try { const parsed = JSON.parse(resBody || '{}'); if (parsed && parsed.webSocketDebuggerUrl) parsed.webSocketDebuggerUrl = this.rewriteWsHost(parsed.webSocketDebuggerUrl, port); return parsed; } catch (e) { return resBody; }
                    }
                } catch (e) {
                    this.logger.log(`[${port}] openTab: host.docker.internal GET threw: ${(e && (e as Error).message) || String(e)}`);
                }
            } else {
                this.logger.log(`[${port}] openTab: trying HTTP PUT ${endpointLocal}`);
                let res = await fetch(endpointLocal, { method: 'PUT', signal: AbortSignal.timeout(5000) });
                if (!res || !res.ok) {
                    this.logger.log(`[${port}] openTab: local /json/new failed (${res ? res.status : 'no-res'}). Falling back to host.docker.internal`);
                    this.logger.log(`[${port}] openTab: host request headers=${JSON.stringify(hostHeaders)}`);
                    try {
                        res = await fetch(endpointHost, { method: 'PUT', signal: AbortSignal.timeout(5000), headers: hostHeaders });
                    } catch (e) {
                        this.logger.log(`[${port}] openTab: host.docker.internal PUT threw: ${(e && (e as Error).message) || String(e)}`);
                    }

                    if (!res || !res.ok) {
                        this.logger.log(`[${port}] openTab: host PUT failed (${res ? res.status : 'no-res'}). Trying GET fallback on host`);
                        try {
                            res = await fetch(endpointHost, { signal: AbortSignal.timeout(5000), headers: hostHeaders });
                        } catch (e) {
                            this.logger.log(`[${port}] openTab: host.docker.internal GET threw: ${(e && (e as Error).message) || String(e)}`);
                        }
                    }
                }

                if (res) {
                    // try to read response body safely
                    let textBody = '';
                    try {
                        textBody = await res.text();
                    } catch (e) {
                        this.logger.log(`[${port}] openTab: failed to read response body: ${(e && (e as Error).message) || String(e)}`);
                    }
                    this.logger.log(`[${port}] openTab: HTTP response status=${res.status} body=${textBody.substring(0,2000)}`);
                    if (res.ok) {
                        try {
                            const parsed = JSON.parse(textBody);
                            // If response contains webSocketDebuggerUrl, rewrite host so container can connect
                            if (parsed && typeof parsed === 'object' && parsed.webSocketDebuggerUrl) {
                                parsed.webSocketDebuggerUrl = this.rewriteWsHost(parsed.webSocketDebuggerUrl, port);
                            }
                            return parsed;
                        } catch (e) {
                            // return raw text if JSON parse fails
                            return textBody;
                        }
                    }
                }
            }
        } catch (e) {
            this.logger.error(`[${port}] openTab: HTTP attempts threw: ${(e && (e as Error).message) || String(e)}`);
        }

        // Fallback: use DevTools Protocol Target.createTarget via chrome-remote-interface
        try {
            this.logger.log(`[CDP-FALLBACK] attempting Target.createTarget on port ${port} -> ${fullUrl}`);
            let CDP: any;
            try {
                CDP = require('chrome-remote-interface');
            } catch (reqErr) {
                this.logger.error(`[CDP-FALLBACK] require('chrome-remote-interface') failed: ${(reqErr && (reqErr as Error).message) || String(reqErr)}`);
                throw reqErr;
            }

            if (typeof CDP !== 'function' && typeof CDP !== 'object') {
                this.logger.error(`[CDP-FALLBACK] chrome-remote-interface not a function/object: ${typeof CDP}`);
                throw new Error('chrome-remote-interface missing or invalid');
            }

            let client: any = null;
            try {
                client = await CDP({ port });
                this.logger.log(`[CDP-FALLBACK] CDP client connected to port ${port}`);
            } catch (connErr) {
                this.logger.error(`[CDP-FALLBACK] CDP connection failed: ${(connErr && (connErr as Error).message) || String(connErr)}`);
                throw connErr;
            }

            // Trap websocket errors if the client exposes a transport
            try {
                if (client && client._ws && typeof client._ws.on === 'function') {
                    client._ws.on('error', (wsErr: any) => {
                        this.logger.error(`[CDP-FALLBACK] client websocket error: ${String(wsErr)}`);
                    });
                }
            } catch (e) {
                // best-effort
            }

            if (client && client.Target && typeof client.Target.createTarget === 'function') {
                const resp = await client.Target.createTarget({ url: fullUrl });
                this.logger.log(`[CDP-FALLBACK] Target.createTarget result: ${JSON.stringify(resp).substring(0,200)}`);
                try { if (typeof client.close === 'function') await client.close(); } catch (err) { this.logger.log(`[CDP-FALLBACK] client.close error: ${(err && (err as Error).message) || String(err)}`); }
                if (resp && resp.targetId) return resp;
            } else {
                this.logger.error('[CDP-FALLBACK] client.Target.createTarget not available');
            }

            try { if (client && typeof client.close === 'function') await client.close(); } catch (err) { this.logger.log(`[CDP-FALLBACK] client.close error: ${(err && (err as Error).message) || String(err)}`); }
        } catch (e) {
            this.logger.error(`[CDP-FALLBACK] failed: ${(e && (e as Error).message) || String(e)}`);
        }

        return null;
    }

    /**
     * Rewrite a DevTools websocket URL host (127.0.0.1 or localhost) to host.docker.internal
     * so the backend running inside Docker can reach the host Chrome instance.
     */
    private rewriteWsHost(wsUrl: string, port: number): string {
        try {
            // replace common localhost patterns
            const replaced = wsUrl.replace('127.0.0.1', 'host.docker.internal').replace('localhost', 'host.docker.internal');
            this.logger.log(`[${port}] rewriteWsHost: ${wsUrl} -> ${replaced}`);
            return replaced;
        } catch (e) {
            return wsUrl;
        }
    }

    /** Focus (activate) a tab by id. Requires CONNECTED state. */
    async focusTab(port: number, tabId: string): Promise<boolean> {
        this.assertConnected(port);
        try {
            const hostHeaders = port === 9223 ? { Host: `localhost:${port}` } as any : { Host: `127.0.0.1:${port}` } as any;
            let res: any = null;
            if (port === 9223) {
                this.logger.log(`[${port}] focusTab: forcing host.docker.internal activate with Host rewrite`);
                res = await fetch(`http://host.docker.internal:${port}/json/activate/${tabId}`, { headers: hostHeaders });
            } else {
                res = await fetch(`http://localhost:${port}/json/activate/${tabId}`);
                if (!res || !res.ok) {
                    this.logger.log(`[${port}] focusTab: falling back to host.docker.internal with Host rewrite`);
                    res = await fetch(`http://host.docker.internal:${port}/json/activate/${tabId}`, { headers: hostHeaders } as any);
                }
            }
            return true;
        } catch {
            return false;
        }
    }

    // ─── STATIC HELPERS ─────────────────────────────

    static portFor(account: 'A' | 'B'): number {
        return account === 'A' ? 9222 : 9223;
    }

    static accountFor(port: number): 'A' | 'B' | null {
        if (port === 9222) return 'A';
        if (port === 9223) return 'B';
        return null;
    }

    // Backward compat aliases
    static getPortForAccount(account: 'A' | 'B'): number { return ChromeConnectionManager.portFor(account); }
    static getAccountForPort(port: number): 'A' | 'B' | null { return ChromeConnectionManager.accountFor(port); }

    // ─── INTERNAL ───────────────────────────────────

    private assertConnected(port: number): void {
        const state = this.ports.get(port)?.state;
        if (state !== 'CONNECTED') {
            throw new Error(`Chrome port ${port} is ${state}, expected CONNECTED`);
        }
    }

    private async fetchTabCount(port: number): Promise<number> {
        try {
            const hostHeaders = port === 9223 ? { Host: `localhost:${port}` } as any : { Host: `127.0.0.1:${port}` } as any;
            let res: any = null;
            if (port === 9223) {
                this.logger.log(`[${port}] PROBE: forcing host.docker.internal /json with Host: localhost:${port}`);
                res = await fetch(`http://host.docker.internal:${port}/json`, { signal: AbortSignal.timeout(2000), headers: hostHeaders });
                if (res) {
                    try {
                        const headers = JSON.stringify(Array.from((res.headers as any).entries()));
                        const text = await res.text().catch(() => '<no-body>');
                        this.logger.log(`[${port}] TABS-HOST RESPONSE: status=${res.status} headers=${headers} body=${text.substring(0,2000)}`);
                    } catch (e) {
                        this.logger.log(`[${port}] TABS-HOST: failed reading response details: ${(e && (e as Error).message) || String(e)}`);
                    }
                }
            } else {
                this.logger.log(`[${port}] PROBE: GET http://localhost:${port}/json`);
                res = await fetch(`http://localhost:${port}/json`, { signal: AbortSignal.timeout(2000) });
                if (res) {
                    try {
                        const headers = JSON.stringify(Array.from((res.headers as any).entries()));
                        const text = await res.text().catch(() => '<no-body>');
                        this.logger.log(`[${port}] TABS-LOCAL RESPONSE: status=${res.status} headers=${headers} body=${text.substring(0,2000)}`);
                    } catch (e) {
                        this.logger.log(`[${port}] TABS-LOCAL: failed reading response details: ${(e && (e as Error).message) || String(e)}`);
                    }
                }
                if (!res || !res.ok) {
                    this.logger.log(`[${port}] PROBE: falling back to host.docker.internal with Host rewrite for /json`);
                    res = await fetch(`http://host.docker.internal:${port}/json`, { signal: AbortSignal.timeout(2000), headers: hostHeaders });
                    if (res) {
                        try {
                            const headers = JSON.stringify(Array.from((res.headers as any).entries()));
                            const text = await res.text().catch(() => '<no-body>');
                            this.logger.log(`[${port}] TABS-HOST RESPONSE: status=${res.status} headers=${headers} body=${text.substring(0,2000)}`);
                        } catch (e) {
                            this.logger.log(`[${port}] TABS-HOST: failed reading response details: ${(e && (e as Error).message) || String(e)}`);
                        }
                    }
                }
            }
            if (!res || !res.ok) return 0;
            // we already consumed body for logging; parse from text to JSON
            const bodyText = await res.text().catch(() => '[]');
            let tabs: any[] = [];
            try { tabs = JSON.parse(bodyText); } catch { tabs = []; }
            return tabs.filter((t: any) => t.type === 'page').length;
        } catch {
            return 0;
        }
    }
}
