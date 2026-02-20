import { Injectable, Logger } from '@nestjs/common';

/**
 * ProviderSessionManager v3.0 — Minimal single-provider manager
 *
 * Holds exactly one bound provider per account (A and B).
 * Calling `bindProvider` when another provider is already bound for the
 * same account will throw an error, enforcing the constitutional rule.
 *
 * This service no longer tracks slots or arrays; it is intentionally
 * lightweight for Phase‑1 minimal engine.
 */

export interface ProviderInfo {
  providerId: string;
  state: 'INIT' | 'READY' | 'ERROR';
  lastEventTime: number;
}

@Injectable()
export class ProviderSessionManager {
  private readonly logger = new Logger(ProviderSessionManager.name);

  /** current binding for each account; null means none bound */
  private bindings: Record<'A' | 'B', ProviderInfo | null> = { A: null, B: null };

  constructor() {
    this.logger.log('ProviderSessionManager v3.0 initialized (single-provider-per-account)');
  }

  /**
   * Bind a provider to an account.
   * Rejects if a different provider is already bound.
   */
  bindProvider(account: 'A' | 'B', providerId: string): ProviderInfo {
    const existing = this.bindings[account];
    if (existing && existing.providerId !== providerId) {
      const msg = `Multiple provider bind attempt for ${account}: existing=${existing.providerId} attempted=${providerId}`;
      this.logger.error(msg);
      throw new Error('MULTI_PROVIDER_NOT_ALLOWED');
    }
    if (!existing) {
      const info: ProviderInfo = { providerId, state: 'READY', lastEventTime: Date.now() };
      this.bindings[account] = info;
      this.logger.log(`[${account}] provider bound ${providerId}`);
      return { ...info };
    }
    // same provider rebind
    return { ...existing };
  }

  /** Clear provider binding for account. */
  clearBinding(account: 'A' | 'B'): void {
    this.bindings[account] = null;
    this.logger.log(`[${account}] provider binding cleared`);
  }

  /** True if account currently has a provider bound. */
  isAccountReady(account: 'A' | 'B'): boolean {
    return this.bindings[account] !== null;
  }

  /** Get current binding info (copy) or null. */
  getBinding(account: 'A' | 'B'): ProviderInfo | null {
    const b = this.bindings[account];
    return b ? { ...b } : null;
  }
}
