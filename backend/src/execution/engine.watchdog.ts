import { getStaleExecutions, forceRelease } from './execution.lock';

const WATCHDOG_INTERVAL_MS = 5000;
const STALE_TIMEOUT_MS = parseInt(String(process.env.EXECUTION_TIMEOUT_MS || '30000'));

function isProduction() {
  return process.env.CI !== 'true' && process.env.NODE_ENV !== 'test';
}

export function startEngineWatchdog() {
  if (!isProduction()) return;
  setInterval(() => {
    try {
      const stale = getStaleExecutions(STALE_TIMEOUT_MS);
      if (stale.length > 0) {
        console.error('[WATCHDOG] Found stale executions:', stale.map(s => s.matchId));
        for (const s of stale) {
          // Force release stale locks
          forceRelease(s.matchId);
          console.error('[WATCHDOG] Force-released execution for', s.matchId);
        }
      }
    } catch (e) {
      console.error('[WATCHDOG] Error:', e && e.message ? e.message : String(e));
    }
  }, WATCHDOG_INTERVAL_MS);
}
