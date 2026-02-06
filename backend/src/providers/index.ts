/**
 * PROVIDER REGISTRY - Central Export
 * ===================================
 * Semua provider config di-export dari sini.
 * 
 * ARCHITECTURE:
 * - User pilih provider per account di Dashboard
 * - System route traffic berdasarkan account, BUKAN domain
 * - Parser tetap per-provider (SABA parser, AFB88 parser)
 * 
 * CURRENT PROVIDERS:
 * - SABA → /saba/
 * - AFB88 → /afb88/
 */

// Base types
export * from './base.provider';

// Account Binding Config (USER-DRIVEN)
export * from './account-binding.config';

// SABA Provider Parser
export { parseSabaPayload } from './saba/saba.parser';

// Provider contracts (centralized folder)
export { default as SABA_CONTRACT } from '../contracts/saba.contract';
export { default as AFB88_CONTRACT } from '../contracts/afb88.contract';
export { default as ALL_CONTRACTS } from '../contracts';

// AFB88 Provider Parser
export { parseAfb88Payload } from './afb88/afb88.parser';

// Routing Service (USE THIS!)
export {
    routeByAccount,
    routeAndParse,
    parseByProvider,
    isNoiseEndpoint,
    isLikelyOddsEndpoint,
    detectProviderFromUrl,  // Legacy, untuk hint saja
} from './provider-detector.service';

// Traffic Router Service (NestJS Injectable)
export { TrafficRouterService } from './traffic-router.service';

// Re-export main types
export type { ProviderConfig, ProviderProfile, ParseResult, ParsedOdds } from './base.provider';
export type { ProviderType, AccountBinding, SystemConfig } from './account-binding.config';
export type { DetectedProvider, RoutingResult } from './provider-detector.service';
export type { TrafficPacket, ProcessedTraffic } from './traffic-router.service';
