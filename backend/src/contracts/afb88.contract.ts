// AFB88 contract scaffold
import type { ProviderConfig, ProviderProfile } from '../providers/base.provider';

export const AFB88_CONTRACT: Partial<ProviderConfig> = Object.freeze({
    name: 'AFB88',
    profile: 'PATH_SESSION' as ProviderProfile,
    whitelabels: ['AFBGaming', 'AFB88'],
    domains: [
        { pattern: /afb88|afb|pgbetodds/i, description: 'AFB88 domains' }
    ],
    oddsEndpoints: [ /odds/i, /pgbetodds/i, /fnoddsgen/i, /prosportslive/i ],
    noiseEndpoints: [ /heartbeat/i, /getbalance/i, /pgmain/i ],
    requiresActivator: false,
    keepalive: { intervalMs: 10000, timeoutMs: 45000 },
    balanceKeys: ['balance', 'userBalance'],
});

export default AFB88_CONTRACT;
