/**
 * Execution Worker v2.0 — CONSTITUTION §III.3 COMPLIANT
 *
 * Worker threads CANNOT access NestJS DI (GlobalExecutionGuard).
 * executeArbitrage() now REQUIRES globalGuard — no bypass.
 *
 * This worker is DISABLED: execution must go through the main thread
 * where GlobalExecutionGuard is available via DI.
 */

import { parentPort } from 'worker_threads';

if (parentPort) {
    parentPort.on('message', async () => {
        console.error('[EXECUTION-WORKER] BLOCKED — Cannot execute outside NestJS DI context (no guard access)');
        parentPort?.postMessage([]);
    });
}
