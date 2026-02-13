// SABA contract scaffold
import type { ProviderConfig, ProviderProfile } from '../providers/base.provider';

export const SABA_CONTRACT: Partial<ProviderConfig> = Object.freeze({
    name: 'SABA',
    profile: 'EVENT_DRIVEN' as ProviderProfile,
    whitelabels: ['SABA', 'SABASPORTS'],
    domains: [
        { pattern: /sabasports|saba/i, description: 'SABA main domains' }
    ],
    oddsEndpoints: [
        /odds/i,
        /match/i,
        /event/i,
        /saba\//i
    ],
    noiseEndpoints: [
        /heartbeat/i,
        /keepalive/i,
        /ping/i
    ],
    requiresActivator: true,
    keepalive: { intervalMs: 15000, timeoutMs: 60000 },
    balanceKeys: ['balance', 'wallet', 'credit'],
});

export default SABA_CONTRACT;
