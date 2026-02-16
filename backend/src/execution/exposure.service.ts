/**
 * Simple in-memory exposure tracker per account.
 * Enforced only in production (NODE_ENV !== 'test' && process.env.CI !== 'true').
 */

const MAX_EXPOSURE_PER_MATCH = parseFloat(String(process.env.MAX_EXPOSURE_PER_MATCH || '1000'));
const MAX_TOTAL_EXPOSURE = parseFloat(String(process.env.MAX_TOTAL_EXPOSURE || '5000'));

type AccountExposure = {
  total: number;
  byMatch: Map<string, number>;
};

const exposures: Map<string, AccountExposure> = new Map();

function isProduction() {
  return process.env.CI !== 'true' && process.env.NODE_ENV !== 'test';
}

export function ensureAccount(accountId: string) {
  if (!exposures.has(accountId)) exposures.set(accountId, { total: 0, byMatch: new Map() });
}

export function canPlace(accountId: string, matchId: string, amount: number): boolean {
  if (!isProduction()) return true; // bypass in CI/test
  ensureAccount(accountId);
  const acc = exposures.get(accountId)!;
  const currentMatch = acc.byMatch.get(matchId) || 0;
  if (currentMatch + amount > MAX_EXPOSURE_PER_MATCH) return false;
  if (acc.total + amount > MAX_TOTAL_EXPOSURE) return false;
  return true;
}

export function addExposure(accountId: string, matchId: string, amount: number) {
  ensureAccount(accountId);
  const acc = exposures.get(accountId)!;
  acc.byMatch.set(matchId, (acc.byMatch.get(matchId) || 0) + amount);
  acc.total = Array.from(acc.byMatch.values()).reduce((s, v) => s + v, 0);
}

export function reduceExposure(accountId: string, matchId: string, amount: number) {
  ensureAccount(accountId);
  const acc = exposures.get(accountId)!;
  const prev = acc.byMatch.get(matchId) || 0;
  const next = Math.max(0, prev - amount);
  if (next === 0) acc.byMatch.delete(matchId); else acc.byMatch.set(matchId, next);
  acc.total = Array.from(acc.byMatch.values()).reduce((s, v) => s + v, 0);
}

export function resetMatchExposure(accountId: string, matchId: string) {
  ensureAccount(accountId);
  const acc = exposures.get(accountId)!;
  acc.byMatch.delete(matchId);
  acc.total = Array.from(acc.byMatch.values()).reduce((s, v) => s + v, 0);
}

export function getExposure(accountId: string) {
  ensureAccount(accountId);
  return exposures.get(accountId)!;
}
