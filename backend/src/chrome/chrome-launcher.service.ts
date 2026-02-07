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
        // 1. Probe — is Chrome already listening?
        if (await this.isPortResponsive(port)) {
            this.logger.log(`[${port}] Chrome already running — reusing`);
            return { launched: false, reused: true, port, message: 'Chrome already running' };
        }

        // 2. Resolve binary
        const binary = this.resolveBinary();
        if (!binary) {
            const msg = 'Chrome binary not found on this machine';
            this.logger.error(msg);
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

        this.logger.log(`[${port}] Spawning Chrome → ${binary}`);

        // 4. Spawn (detached, unref — Chrome lives beyond our process)
        try {
            this.spawnDetached(binary, args);
        } catch (err: any) {
            return { launched: false, reused: false, port, message: `Spawn failed: ${err.message}` };
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

    /** Spawn Chrome detached so it outlives our process. */
    private spawnDetached(binary: string, args: string[]): void {
        const { spawn } = require('child_process') as typeof import('child_process');
        const child = spawn(binary, args, {
            detached: true,
            stdio: 'ignore',
            windowsHide: false,
        });
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
