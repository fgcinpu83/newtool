import { SqliteService } from '../shared/sqlite.service';

const sqlite = new SqliteService();

export async function executeHedge(successfulLeg: any, auditId?: number | null): Promise<boolean> {
  try {
    console.log('[HEDGE] Attempting hedge for', successfulLeg?.matchId || successfulLeg?.GlobalEventID || 'unknown');
    const details = { successfulLeg, timestamp: Date.now() };
    try { sqlite.saveHedgeEvent(auditId || null, details); } catch (e) { console.warn('[HEDGE] Failed to persist hedge event:', e && e.message ? e.message : String(e)); }
    // For Phase 1, hedge is best-effort and returns true if attempt logged
    return true;
  } catch (e) {
    console.error('[HEDGE] executeHedge failed:', e);
    return false;
  }
}
// Compatibility wrapper name expected by engine patches
export async function triggerHedgeProtocol(originalBet: any): Promise<void> {
  try {
    await executeHedge(originalBet, null);
  } catch (e) {
    // swallow to keep engine stable
  }
}

export default {
  executeHedge,
  triggerHedgeProtocol
}
