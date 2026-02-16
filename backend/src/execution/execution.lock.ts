/**
 * Simple in-process execution tracker & lock for double-run protection.
 * Not a distributed lock — designed for single-process Node.js server.
 */

type ExecEntry = { matchId: string; startedAt: number };

const executingMatches: Map<string, ExecEntry> = new Map();

export function isExecuting(matchId: string): boolean {
  return executingMatches.has(matchId);
}

export function startExecution(matchId: string): void {
  executingMatches.set(matchId, { matchId, startedAt: Date.now() });
}

export function endExecution(matchId: string): void {
  executingMatches.delete(matchId);
}

export function getStaleExecutions(timeoutMs: number): ExecEntry[] {
  const now = Date.now();
  const stale: ExecEntry[] = [];
  for (const e of executingMatches.values()) {
    if (now - e.startedAt > timeoutMs) stale.push(e);
  }
  return stale;
}

export function forceRelease(matchId: string): void {
  executingMatches.delete(matchId);
}

export function clearAllExecutions(): void {
  executingMatches.clear();
}
