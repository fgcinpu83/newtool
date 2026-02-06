import { parseSaba, ParsedMatch } from './saba';
import { parseAfb88 } from './afb88';

export type ProviderParser = (body: string | object) => ParsedMatch[];

export const CONTRACTS: Record<string, ProviderParser> = {
    'SABA': parseSaba,
    'ISPORT': parseSaba,
    'AFB88': parseAfb88,
    'AFB': parseAfb88
};

export function parseProvider(provider: string, body: string | object): ParsedMatch[] {
    const key = (provider || '').toUpperCase();
    const fn = CONTRACTS[key];
    if (!fn) return [];
    try { return fn(body); } catch (e) { return []; }
}

export function listProviders() {
    return Object.keys(CONTRACTS);
}
import SABA_CONTRACT from './saba.contract';
import AFB88_CONTRACT from './afb88.contract';

export const ALL_CONTRACTS = [SABA_CONTRACT, AFB88_CONTRACT];

export { SABA_CONTRACT, AFB88_CONTRACT };
export default ALL_CONTRACTS;
