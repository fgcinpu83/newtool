export type ProviderClass = 'AUTO_PUSH' | 'PATH_SESSION' | 'EVENT_DRIVEN' | 'ENCRYPTED' | 'WEBSOCKET_STREAM' | 'DOM_RENDERED';

export interface ProviderDefinition {
    class: ProviderClass;
    oddsEndpoints: string[];
    heartbeat?: string[];
    requiresActivator: boolean;
    requiresSessionPath?: boolean;

    // 🛡️ v3.2 SESSION KEEPALIVE CONFIG
    keepalive?: {
        endpoint: string;           // Lightweight API to touch
        interval: number;           // Milliseconds between keepalive pings
        sessionTTL: number;         // Session timeout in milliseconds
        method: 'GET' | 'POST';     // HTTP method
    };
}

export const PROVIDERS: Record<string, ProviderDefinition> = Object.freeze({
    AFB88: {
        class: 'EVENT_DRIVEN',
        oddsEndpoints: ['pgBetOdds', 'fnoddsgen'],
        heartbeat: ['pgMain'],
        requiresActivator: true,
        keepalive: {
            endpoint: '/api/pgMain',
            interval: 45000,        // 45 seconds
            sessionTTL: 300000,     // 5 minutes
            method: 'GET'
        }
    },

    ISPORT: {
        class: 'PATH_SESSION',
        oddsEndpoints: ['GetOdds', 'Sports', 'Data', 'MatchList', 'pgMain'],
        requiresActivator: false,
        requiresSessionPath: true,
        keepalive: {
            endpoint: '/Statement/BetListMini',
            interval: 30000,        // 30 seconds (SABA tends to expire faster)
            sessionTTL: 180000,     // 3 minutes
            method: 'GET'
        }
    },

    CMD368: {
        class: 'AUTO_PUSH',
        oddsEndpoints: ['SportItems', 'GetSportItems', 'getMatch'],
        requiresActivator: false,
        keepalive: {
            endpoint: '/api/Lottery/GetBalance',
            interval: 60000,        // 60 seconds
            sessionTTL: 600000,     // 10 minutes
            method: 'GET'
        }
    },

    GENERIC: {
        class: 'AUTO_PUSH',
        oddsEndpoints: [],
        requiresActivator: false,
    }
});
