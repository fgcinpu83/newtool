/**
 * CDPSessionManager v1.0 — CONSTITUTION §III.1 COMPLIANT (STEP 3.2)
 *
 * SINGLE SOURCE OF TRUTH untuk CDP WebSocket session.
 *
 * State machine:
 *   IDLE → ATTACHING → ATTACHED → IDLE (via detach)
 *                  ↘ ERROR ↗
 *
 * Rules:
 *   1. attach() HANYA boleh dipanggil jika ChromeConnectionManager.state === CONNECTED
 *   2. attach() idempotent — jika ATTACHING / ATTACHED → return (no-op)
 *   3. detach() HANYA dari ATTACHED — reset ke IDLE
 *   4. Semua CDP WebSocket connect/disconnect HARUS lewat CDPSessionManager
 *   5. HANYA satu CDP session aktif per port
 *   6. Tidak memilih tab — tab selection bukan tanggung jawab step ini
 *
 * INVARIANTS:
 *   - Tidak mungkin double attach
 *   - Tidak ada file lain yang boleh buka CDP WebSocket langsung
 *   - State NEVER goes backwards tanpa explicit detach()
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ChromeConnectionManager } from './chrome-connection.manager';
import WebSocket from 'ws';

// ─── State Machine ───────────────────────────────────
export type CDPSessionState = 'IDLE' | 'ATTACHING' | 'ATTACHED' | 'ERROR';

const ALLOWED_TRANSITIONS: Record<CDPSessionState, CDPSessionState[]> = {
    IDLE:      ['ATTACHING'],
    ATTACHING: ['ATTACHED', 'ERROR', 'IDLE'],
    ATTACHED:  ['IDLE', 'ERROR'],
    ERROR:     ['IDLE', 'ATTACHING'],
};

// ─── Per-port CDP session info ───────────────────────
export interface CDPSessionInfo {
    port: number;
    state: CDPSessionState;
    wsUrl: string | null;
    attachedAt: number | null;
    errorMessage: string | null;
}

// ─── CDP Command Response ────────────────────────────
interface CDPMessage {
    id: number;
    method?: string;
    params?: any;
    result?: any;
    error?: { code: number; message: string };
}

@Injectable()
export class CDPSessionManager {
    private readonly logger = new Logger(CDPSessionManager.name);

    /** Per-port session state */
    private readonly sessions: Map<number, CDPSessionInfo> = new Map();

    /** Per-port active WebSocket (the ONE session) */
    private readonly sockets: Map<number, WebSocket> = new Map();

    /** Per-port message counter for CDP protocol */
    private readonly messageIds: Map<number, number> = new Map();

    constructor(
        @Inject(forwardRef(() => ChromeConnectionManager))
        private readonly chromeManager: ChromeConnectionManager,
    ) {
        for (const port of [9222, 9223]) {
            this.sessions.set(port, {
                port,
                state: 'IDLE',
                wsUrl: null,
                attachedAt: null,
                errorMessage: null,
            });
            this.messageIds.set(port, 1);
        }
        this.logger.log('CDPSessionManager v1.0 initialized (ports 9222, 9223)');
    }

    // ─── STATE MACHINE CORE ─────────────────────────

    /**
     * Transition state with validation.
     * THROWS if transition is illegal.
     */
    private transition(port: number, to: CDPSessionState, extra?: Partial<CDPSessionInfo>): void {
        const info = this.sessions.get(port);
        if (!info) throw new Error(`[CDPSessionManager] Unknown port: ${port}`);

        const from = info.state;
        if (from === to) return; // noop

        if (!ALLOWED_TRANSITIONS[from].includes(to)) {
            const msg = `[CDPSessionManager] Illegal transition ${from} → ${to} on port ${port}`;
            this.logger.error(msg);
            throw new Error(msg);
        }

        this.sessions.set(port, { ...info, ...extra, state: to });
        this.logger.log(`[${port}] CDP ${from} → ${to}`);
    }

    // ─── PUBLIC API ─────────────────────────────────

    /**
     * Attach a CDP WebSocket session to the browser on the given port.
     *
     * IDEMPOTENT:
     *   - ATTACHING / ATTACHED → return current info (no-op)
     *   - IDLE / ERROR → attempt attach
     *
     * PRECONDITION:
     *   - ChromeConnectionManager.state(port) === 'CONNECTED'
     *   - Jika tidak → throw (DILARANG bypass)
     */
    async attach(port: number): Promise<CDPSessionInfo> {
        const session = this.getInfo(port);

        // ── Idempotent: already attaching or attached → return ──
        if (session.state === 'ATTACHING' || session.state === 'ATTACHED') {
            this.logger.log(`[${port}] attach() idempotent — already ${session.state}`);
            return session;
        }

        // ── Precondition: Chrome MUST be CONNECTED ──
        const chromeInfo = this.chromeManager.getInfo(port);
        if (chromeInfo.state !== 'CONNECTED') {
            const msg = `[CDPSessionManager] Cannot attach — ChromeConnectionManager port ${port} is ${chromeInfo.state}, expected CONNECTED`;
            this.logger.error(msg);
            throw new Error(msg);
        }

        // ── Transition: IDLE/ERROR → ATTACHING ──
        this.transition(port, 'ATTACHING');

        try {
            // Fetch browser WebSocket URL from CDP /json/version
            const wsUrl = await this.fetchBrowserWsUrl(port);

            // Open WebSocket to the browser-level CDP endpoint
            const ws = await this.openWebSocket(wsUrl, port);

            // Store the SINGLE active socket
            this.sockets.set(port, ws);

            // Transition: ATTACHING → ATTACHED
            this.transition(port, 'ATTACHED', {
                wsUrl,
                attachedAt: Date.now(),
                errorMessage: null,
            });

            this.logger.log(`[${port}] CDP session ATTACHED — ${wsUrl}`);
            return this.getInfo(port);
        } catch (err: any) {
            // Cleanup socket if partially opened
            this.cleanupSocket(port);

            this.transition(port, 'ERROR', {
                wsUrl: null,
                attachedAt: null,
                errorMessage: err.message,
            });

            this.logger.error(`[${port}] CDP attach FAILED — ${err.message}`);
            return this.getInfo(port);
        }
    }

    /**
     * Detach the CDP WebSocket session.
     *
     * ONLY valid from ATTACHED state. Resets to IDLE.
     * IDLE / ATTACHING / ERROR → no-op (log warning).
     */
    detach(port: number): void {
        const session = this.sessions.get(port);
        if (!session) return;

        if (session.state !== 'ATTACHED') {
            this.logger.warn(`[${port}] detach() called in state ${session.state} — ignoring`);
            return;
        }

        // Close WebSocket
        this.cleanupSocket(port);

        // Transition: ATTACHED → IDLE
        this.transition(port, 'IDLE', {
            wsUrl: null,
            attachedAt: null,
            errorMessage: null,
        });

        this.logger.log(`[${port}] CDP session DETACHED → IDLE`);
    }

    /**
     * Detach all ports (shutdown cleanup).
     */
    detachAll(): void {
        for (const port of this.sessions.keys()) {
            // Force cleanup regardless of state
            this.cleanupSocket(port);
            this.sessions.set(port, {
                port,
                state: 'IDLE',
                wsUrl: null,
                attachedAt: null,
                errorMessage: null,
            });
        }
        this.logger.log('All CDP sessions detached');
    }

    // ─── CDP COMMAND API ────────────────────────────

    /**
     * Send a CDP command over the active session.
     * REQUIRES state === ATTACHED.
     * Returns the CDP result payload.
     */
    async sendCommand(port: number, method: string, params: Record<string, any> = {}): Promise<any> {
        this.assertAttached(port);

        const ws = this.sockets.get(port);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            // Session corrupted — force error
            this.transition(port, 'ERROR', {
                errorMessage: 'WebSocket not open (stale)',
            });
            throw new Error(`[CDPSessionManager] WebSocket not open on port ${port}`);
        }

        const id = this.nextMessageId(port);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.off('message', handler);
                reject(new Error(`CDP timeout waiting for response to ${method} (id=${id})`));
            }, 10_000);

            const handler = (data: WebSocket.Data) => {
                try {
                    const message: CDPMessage = JSON.parse(data.toString());
                    if (message.id === id) {
                        clearTimeout(timeout);
                        ws.off('message', handler);
                        if (message.error) {
                            reject(new Error(`CDP error: ${message.error.message}`));
                        } else {
                            resolve(message.result);
                        }
                    }
                } catch {
                    // Ignore non-JSON or non-matching messages
                }
            };

            ws.on('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    // ─── READ-ONLY QUERIES ──────────────────────────

    /** Get session info for port (copy). Throws if unknown port. */
    getInfo(port: number): CDPSessionInfo {
        const info = this.sessions.get(port);
        if (!info) throw new Error(`[CDPSessionManager] Unknown port: ${port}`);
        return { ...info };
    }

    /** Get session info for account. */
    getInfoForAccount(account: 'A' | 'B'): CDPSessionInfo {
        return this.getInfo(CDPSessionManager.portFor(account));
    }

    /** Get all session states (copy). */
    getAllStates(): Record<number, CDPSessionInfo> {
        const result: Record<number, CDPSessionInfo> = {};
        for (const [port, info] of this.sessions) {
            result[port] = { ...info };
        }
        return result;
    }

    /** Is the port in ATTACHED state? */
    isAttached(port: number): boolean {
        return this.sessions.get(port)?.state === 'ATTACHED';
    }

    /** Is the account's CDP session attached? */
    isAccountAttached(account: 'A' | 'B'): boolean {
        return this.isAttached(CDPSessionManager.portFor(account));
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

    // ─── INTERNAL ───────────────────────────────────

    /** Assert state is ATTACHED. Throws otherwise. */
    private assertAttached(port: number): void {
        const state = this.sessions.get(port)?.state;
        if (state !== 'ATTACHED') {
            throw new Error(`[CDPSessionManager] Port ${port} is ${state}, expected ATTACHED`);
        }
    }

    /** Fetch the browser-level WebSocket debugger URL from /json/version. */
    private async fetchBrowserWsUrl(port: number): Promise<string> {
        const res = await fetch(`http://localhost:${port}/json/version`, {
            signal: AbortSignal.timeout(3_000),
        });

        if (!res.ok) {
            throw new Error(`CDP /json/version returned HTTP ${res.status}`);
        }

        const data = await res.json();
        const wsUrl = data.webSocketDebuggerUrl;

        if (!wsUrl || typeof wsUrl !== 'string') {
            throw new Error('CDP /json/version did not return webSocketDebuggerUrl');
        }

        return wsUrl;
    }

    /** Open a WebSocket and wait for 'open' event. */
    private openWebSocket(wsUrl: string, port: number): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(wsUrl);

            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error(`WebSocket connection timeout for ${wsUrl}`));
            }, 5_000);

            ws.on('open', () => {
                clearTimeout(timeout);
                this.logger.log(`[${port}] CDP WebSocket connected`);

                // Monitor for unexpected close → auto-transition to ERROR
                ws.on('close', () => {
                    this.logger.warn(`[${port}] CDP WebSocket closed unexpectedly`);
                    this.handleSocketClose(port);
                });

                ws.on('error', (err) => {
                    this.logger.error(`[${port}] CDP WebSocket error: ${err.message}`);
                    this.handleSocketError(port, err.message);
                });

                resolve(ws);
            });

            ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    /** Handle unexpected WebSocket close. */
    private handleSocketClose(port: number): void {
        const session = this.sessions.get(port);
        if (!session) return;

        // Only transition if we were ATTACHED (not already detaching)
        if (session.state === 'ATTACHED') {
            this.cleanupSocket(port);
            try {
                this.transition(port, 'ERROR', {
                    errorMessage: 'WebSocket closed unexpectedly',
                });
            } catch {
                // Transition may fail if already in ERROR — safe to ignore
            }
        }
    }

    /** Handle WebSocket error. */
    private handleSocketError(port: number, message: string): void {
        const session = this.sessions.get(port);
        if (!session) return;

        if (session.state === 'ATTACHED') {
            this.cleanupSocket(port);
            try {
                this.transition(port, 'ERROR', {
                    errorMessage: `WebSocket error: ${message}`,
                });
            } catch {
                // safe to ignore
            }
        }
    }

    /** Close and remove the WebSocket for a port. */
    private cleanupSocket(port: number): void {
        const ws = this.sockets.get(port);
        if (ws) {
            try {
                // Remove all listeners to prevent re-entry
                ws.removeAllListeners();
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            } catch {
                // Ignore close errors
            }
            this.sockets.delete(port);
        }
    }

    /** Get next message ID for CDP protocol. */
    private nextMessageId(port: number): number {
        const current = this.messageIds.get(port) || 1;
        this.messageIds.set(port, current + 1);
        return current;
    }
}
