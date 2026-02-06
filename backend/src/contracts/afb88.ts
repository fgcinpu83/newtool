import { ParsedMatch } from './saba';

export function parseAfb88(body: string | object): ParsedMatch[] {
    let obj: any = body;
    if (typeof body === 'string') {
        try { obj = JSON.parse(body); } catch (e) { obj = { raw: body }; }
    }

    const out: ParsedMatch[] = [];

    // AFB-like payloads often put matches under data.MatchList or results
    const list = obj?.data?.MatchList || obj?.MatchList || obj?.matches || obj?.events || null;
    if (!list || !Array.isArray(list)) return out;

    // For AFB88, we prefer the legacy parser which handles complex market types
    // Return empty so worker service falls back to parseAfbPacket
    return out;
}
