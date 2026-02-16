/**
 * ChromeLauncher v1.0 — CONSTITUTION §III.1 (STEP 3.1)
 *
 * Controlled Chrome process launcher.
 *
 * Rules:
 *   - Idempotent: if Chrome already responds on the debug port → reuse, don't re-launch
 *   - Launch with --remote-debugging-port (9222 / 9223)
 *   - Separate --user-data-dir per account
 *   - NO CDP connection (that's ChromeConnectionManager's job)
 *   - NO tab selection
 *   - ONLY called by ChromeConnectionManager (ensureChromeRunning)
 */

import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ─── Chrome binary search paths (Windows) ───────────
const CHROME_SEARCH_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
];

export interface LaunchResult {
    launched: boolean;
    reused: boolean;
    port: number;
    message: string;
}

@Injectable()
export class ChromeLauncher {
    private readonly logger = new Logger(ChromeLauncher.name);

    /** Resolved Chrome binary path (cached after first lookup). */
    private chromePath: string | null | undefined = undefined; // undefined = not yet searched

    /** Per-port launch-in-progress lock to prevent concurrent spawns. */
    private readonly launching = new Map<number, Promise<LaunchResult>>();

    // ─── PUBLIC API (called by ChromeConnectionManager ONLY) ─────

    /**
     * Ensure Chrome is running with --remote-debugging-port on `port`.
     *
     * Idempotent:
     *   1. Probe http://localhost:{port}/json/version
     *   2. If responds → Chrome is already up → return reused:true
     *   3. If not → spawn Chrome process → wait for port to become responsive
     *
     * Does NOT create a CDP connection or pick tabs.
     */
    async ensureRunning(port: number): Promise<LaunchResult> {
        // Coalesce concurrent calls for the same port
        const inflight = this.launching.get(port);
        if (inflight) {
            this.logger.log(`[${port}] ensureRunning() coalesced — waiting for in-flight launch`);
            return inflight;
        }

        const promise = this._ensureRunning(port);
        this.launching.set(port, promise);

        try {
            return await promise;
        } finally {
            this.launching.delete(port);
        }
    }

    // ─── INTERNALS ──────────────────────────────────

    private async _ensureRunning(port: number): Promise<LaunchResult> {
        // CI / test safe-mode: do NOT spawn or probe real Chrome in CI/test environments.
        // This makes the runtime deterministic for CI and unit tests that run with NODE_ENV=test.
        const __IS_CI = process.env.CI === 'true';
        const IS_TEST = process.env.NODE_ENV === 'test';
        const IS_PRODUCTION = process.env.NODE_ENV === 'production';

        // In production strict mode, mock mode is forbidden
        if (IS_PRODUCTION && (__IS_CI || IS_TEST)) {
            const msg = 'Production strict mode forbids CI/TEST mock mode';
            this.logger.error(msg);
            try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'PROD_STRICT_MOCK_FORBIDDEN', port, message: msg }) + '\n'); } catch (e) {}
            return { launched: false, reused: false, port, message: msg };
        }

        // If running in CI/TEST, prefer to detect a host bridge first: many dev setups
        // start Chrome on the host (Windows) and expose it to Docker via
        // host.docker.internal. If that endpoint is responsive we should reuse it
        // instead of returning a CI mock. Only if no host bridge exists do we keep
        // CI/TEST mock behavior.
        if (__IS_CI || IS_TEST) {
            const hostResponsive = await this.isHostResponsive(port);
            if (hostResponsive) {
                this.logger.log(`[CHROME_LAUNCH_DETECT] CI/TEST but host.docker.internal responsive on port ${port} — reusing host Chrome`);
                try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'CHROME_LAUNCH_DETECT', port, host: 'host.docker.internal' }) + '\n'); } catch (e) {}
                return { launched: false, reused: true, port, message: 'Host bridge responsive (host.docker.internal)' };
            }

            this.logger.log(`[CHROME_LAUNCH_MOCK] CI/TEST mode — simulating Chrome on port ${port}`);
            try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'CHROME_LAUNCH_MOCK', port }) + '\n'); } catch (e) {}
            return { launched: true, reused: false, port, message: 'CI/TEST mocked chrome' };
        }

        // 1. Probe — is Chrome already listening?
        if (await this.isPortResponsive(port)) {
            // CDP already present — log explicit diagnostic so post-mortem can distinguish reuse vs launch-failure
            this.logger.log(`[CDP_ALREADY_RUNNING] [${port}] Chrome already running — reusing`);
            try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'CDP_ALREADY_RUNNING', port }) + '\n'); } catch (e) {}
            return { launched: false, reused: true, port, message: 'Chrome already running' };
        }

        // 2. Resolve binary / Host-probe override
        // If not running in CI, prefer to probe the host bridge first (host.docker.internal)
        // and fall back to the Docker gateway (172.17.0.1). The intent: the Chrome
        // binary is expected to live on the host, not inside the container. Do not
        // emit a "Chrome binary not found" error when running in non-CI dev mode.
        if (!__IS_CI) {
            const hostResponsive = await this.isHostResponsive(port);
            if (hostResponsive) {
                this.logger.log(`[CHROME_LAUNCH_DETECT] Non-CI: host.docker.internal responsive on port ${port} — reusing host Chrome`);
                try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'CHROME_LAUNCH_DETECT_HOST', port, host: 'host.docker.internal' }) + '\n'); } catch (e) {}
                return { launched: false, reused: true, port, message: 'Host bridge responsive (host.docker.internal)' };
            }

            const gatewayResponsive = await this.isGatewayResponsive(port);
            if (gatewayResponsive) {
                this.logger.log(`[CHROME_LAUNCH_DETECT] Non-CI: gateway 172.17.0.1 responsive on port ${port} — reusing host Chrome`);
                try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'CHROME_LAUNCH_DETECT_HOST', port, host: '172.17.0.1' }) + '\n'); } catch (e) {}
                return { launched: false, reused: true, port, message: 'Host bridge responsive (172.17.0.1)' };
            }

            this.logger.log(`[CHROME_LAUNCH_PROBE] Non-CI: host and gateway probes failed for port ${port}; continuing to normal launch/resolution`);
            try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'CHROME_LAUNCH_PROBE_FAIL', port }) + '\n'); } catch (e) {}
        }

        // Normal resolve & spawn path (used in CI or when host probes didn't find a bridge)
        const binary = this.resolveBinary();
        if (!binary) {
            // In non-CI mode prefer not to spam an error about a missing binary —
            // upstream callers expect host-provided Chrome. Emit a diagnostic but
            // avoid the prior hard error message.
            const msg = 'No local Chrome binary found; host probes did not respond';
            this.logger.warn(msg);
            try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'CHROME_NOT_FOUND_BYPASS', port, message: msg }) + '\n'); } catch (e) {}
            return { launched: false, reused: false, port, message: msg };
        }

        // 3. Build args
        const account = port === 9222 ? 'A' : port === 9223 ? 'B' : `P${port}`;
        const userDataDir = path.join(
            process.env.TEMP || 'C:\\Temp',
            `chrome-debug-${account}`,
        );

        const args = [
            `--remote-debugging-port=${port}`,
            `--user-data-dir=${userDataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-networking',
            '--disable-client-side-phishing-detection',
            '--disable-default-apps',
            '--disable-hang-monitor',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-sync',
            '--metrics-recording-only',
            '--no-first-run',
        ];

        this.logger.log(`[CHROME_LAUNCH_ATTEMPT] [${port}] Spawning Chrome → ${binary} (userDataDir=${userDataDir})`);
        try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'CHROME_LAUNCH_ATTEMPT', port, userDataDir }) + '\n'); } catch (e) {}

        // 4. Spawn (detached, unref — Chrome lives beyond our process)
        try {
            this.spawnDetached(binary, args, { watchEarlyExitMs: 5000, port, userDataDir });
        } catch (err: any) {
            const msg = `Spawn failed: ${err && err.message ? err.message : String(err)}`;
            this.logger.error(`[CHROME_LAUNCH_FAIL] [${port}] ${msg}`);
            try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'CHROME_LAUNCH_FAIL', port, message: msg }) + '\n'); } catch (e) {}
            return { launched: false, reused: false, port, message: msg };
        }

        // 5. Wait for port to become responsive (up to 8 seconds)
        const alive = await this.waitForPort(port, 8000);

        if (alive) {
            this.logger.log(`[${port}] Chrome is responsive after launch`);
            return { launched: true, reused: false, port, message: 'Chrome launched successfully' };
        }

        const msg = `Chrome spawned but port ${port} not responsive within timeout`;
        this.logger.warn(msg);
        return { launched: false, reused: false, port, message: msg };
    }

    /** Probe CDP /json/version endpoint — true if Chrome responds. */
    private async isPortResponsive(port: number): Promise<boolean> {
        try {
            const res = await fetch(`http://localhost:${port}/json/version`, {
                signal: AbortSignal.timeout(2000),
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    /** Check host.docker.internal for responsive CDP (useful when Chrome runs on the Windows host). */
    private async isHostResponsive(port: number): Promise<boolean> {
        try {
            // When probing port 9223 we must set a Host header — use native http request so header is honored.
            if (port === 9223) {
                try {
                    const http = require('http');
                    const opts: any = { method: 'HEAD', host: 'host.docker.internal', port, path: '/json/version', headers: { Host: 'localhost:9223' }, timeout: 2000 };
                    const result = await new Promise<boolean>((resolve) => {
                        const req = http.request(opts, (res: any) => resolve(res.statusCode >= 200 && res.statusCode < 400));
                        req.on('error', () => resolve(false));
                        req.on('timeout', () => { try { req.destroy(); } catch (e) {} resolve(false); });
                        req.end();
                    });

                    // Emit immediate diagnostic so runtime logs show the exact probe outcome.
                    try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'HOST_PROBE_9223', port, result }) + '\n'); } catch (e) { /* swallow */ }
                    this.logger.debug(`[HOST_PROBE] host.docker.internal:9223 -> ${result}`);
                    return result;
                } catch (e) {
                    try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'HOST_PROBE_9223', port, result: false, error: String(e) }) + '\n'); } catch (err) { /* swallow */ }
                    return false;
                }
            }

            const res = await fetch(`http://host.docker.internal:${port}/json/version`, {
                signal: AbortSignal.timeout(2000),
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    /** Check Docker gateway IP (172.17.0.1) for responsive CDP as a fallback. */
    private async isGatewayResponsive(port: number): Promise<boolean> {
        try {
            const res = await fetch(`http://172.17.0.1:${port}/json/version`, {
                signal: AbortSignal.timeout(2000),
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    /** Poll port until responsive or timeout. */
    private async waitForPort(port: number, timeoutMs: number): Promise<boolean> {
        const start = Date.now();
        const interval = 500;

        while (Date.now() - start < timeoutMs) {
            if (await this.isPortResponsive(port)) return true;
            await this.sleep(interval);
        }
        return false;
    }

    /** Spawn Chrome detached so it outlives our process. Adds optional "early-exit" watch for quick diagnostics. */
    private spawnDetached(binary: string, args: string[], opts?: { watchEarlyExitMs?: number; port?: number; userDataDir?: string }): void {
        const { spawn } = require('child_process') as typeof import('child_process');
        const start = Date.now();
        const child = spawn(binary, args, {
            detached: true,
            stdio: 'ignore',
            windowsHide: false,
        });

        // Watch for early exit (helpful to detect permission/launch issues quickly).
        if (opts && opts.watchEarlyExitMs && opts.watchEarlyExitMs > 0) {
            const timeoutMs = opts.watchEarlyExitMs;
            const port = opts.port;
            const userDataDir = opts.userDataDir;

            const onExit = (code: number | null, signal: string | null) => {
                const elapsed = Date.now() - start;
                // If Chrome exited earlier than the watch window, emit diagnostic logs
                if (elapsed < timeoutMs) {
                    const msg = `[CHROME_EXIT_EARLY] port=${port} userDataDir=${userDataDir} exitCode=${code} signal=${signal} elapsedMs=${elapsed}`;
                    try { fs.appendFileSync(path.join(process.cwd(), 'wire_debug.log'), JSON.stringify({ ts: Date.now(), tag: 'CHROME_EXIT_EARLY', port, code, signal, elapsed }) + '\n'); } catch (e) {}
                    // Also surface to logger for immediate visibility
                    this.logger.error(msg);
                }
            };

            // Note: even for detached children, `exit` event may be emitted before unref
            child.on('exit', onExit);

            // Set a safety timer to remove the listener after the watch window
            setTimeout(() => {
                try { child.removeListener('exit', onExit); } catch (e) { /* swallow */ }
            }, timeoutMs + 50);
        }

        child.unref();
    }

    /** Resolve Chrome binary path (cached). */
    private resolveBinary(): string | null {
        if (this.chromePath !== undefined) return this.chromePath;

        for (const p of CHROME_SEARCH_PATHS) {
            if (p && fs.existsSync(p)) {
                this.chromePath = p;
                this.logger.log(`Chrome binary found: ${p}`);
                return p;
            }
        }

        this.chromePath = null;
        return null;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
