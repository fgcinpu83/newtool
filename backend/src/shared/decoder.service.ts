import { Injectable, Logger } from '@nestjs/common';
import * as zlib from 'zlib';
import { promisify } from 'util';

const unzipAsync = promisify(zlib.unzip);

@Injectable()
export class UniversalDecoderService {
    private readonly logger = new Logger(UniversalDecoderService.name);

    /**
     * 🚀 TAHAP 3.5: Robust Decoder for GZIP/Base64/Socket.io
     * Mission: Prevent SyntaxError/Ghost Match by inflating data before parsing.
     */
    async decode(raw: any): Promise<any> {
        if (!raw) return null;
        let payload = raw;

        // 1. PEMBERSIHAN SOCKET.IO
        if (typeof payload === 'string') {
            if (payload.startsWith('42[')) {
                try {
                    const parsed = JSON.parse(payload.substring(2));
                    payload = Array.isArray(parsed) ? parsed[1] : parsed;
                } catch (e) {
                    payload = payload.substring(payload.indexOf('['));
                }
            } else if (/^\d+/.test(payload)) {
                payload = payload.replace(/^\d+/, '');
            }
        }

        return await this.safeDecodePayload(payload);
    }

    private async safeDecodePayload(data: any): Promise<any> {
        if (!data) return data;

        // Cek 1: Apakah ini sudah berupa object/JSON?
        if (typeof data === 'object') return data;

        // Cek 2: Apakah ini string JSON?
        if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
            try {
                return JSON.parse(data);
            } catch (e) { /* continue to inflation check */ }
        }

        // 🚀 TAHAP 3.5: GZIP/Base64 Inflation ('H4s' signature)
        // Langkah 1: Cek Signature & Non-JSON chars
        const isGzip = typeof data === 'string' && (data.startsWith('H4sIA') || (!data.includes('{') && data.length > 100));

        if (isGzip) {
            try {
                const buffer = Buffer.from(data, 'base64');
                const decompressed = await unzipAsync(buffer);
                const jsonStr = decompressed.toString('utf-8');
                this.logger.debug(`[INFLATOR] 🎈 Payload inflated: ${data.substring(0, 15)}... -> ${jsonStr.substring(0, 50)}`);
                return JSON.parse(jsonStr);
            } catch (err) {
                this.logger.error(`[INFLATOR-ERROR] Failed to inflate: ${err.message}`);
                return data; // Fail-safe: return original
            }
        }

        // Cek 3: Apakah ini Base64 standar?
        if (typeof data === 'string' && this.isBase64(data)) {
            const buffer = Buffer.from(data, 'base64');
            // Try decompression even if it doesn't start with H4s (some headers vary)
            if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
                try {
                    const decompressed = await unzipAsync(buffer);
                    return JSON.parse(decompressed.toString('utf-8'));
                } catch (e) { /* fallback to binary */ }
            }
            return this.decodeBinary(buffer);
        }

        // Cek 4: Jika data mentah berupa buffer/Uint8Array
        if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
            const buf = Buffer.from(data);
            // GZIP Check for raw binary
            if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
                try {
                    const decompressed = await unzipAsync(buf);
                    return JSON.parse(decompressed.toString('utf-8'));
                } catch (e) { /* fallback */ }
            }
            return this.decodeBinary(buf);
        }

        return data;
    }

    /**
     * 🛡️ HEURISTIC PROTOBUF DECODER
     * Decodes binary without .proto schema using tag/wire-type scanning.
     */
    private decodeBinary(buffer: Buffer): any {
        // Cek apakah terlihat seperti Protobuf (heuristic: has varints or tags)
        // Jika sangat pendek, mungkin bukan.
        if (buffer.length < 2) return buffer.toString('utf-8');

        // Simple check if it's actually ASCII string hidden in binary
        const asString = buffer.toString('utf-8');
        if (/^[a-zA-Z0-9\s.,:[\]{}"]+$/.test(asString.substring(0, 100)) && asString.includes(':')) {
            try { return JSON.parse(asString); } catch (e) { return asString; }
        }

        const result: any = {};
        let offset = 0;

        try {
            while (offset < buffer.length) {
                const key = buffer[offset++];
                const wireType = key & 0x07;
                const fieldNumber = key >> 3;

                if (fieldNumber === 0) break;

                let value: any;
                if (wireType === 0) { // Varint
                    let shift = 0;
                    value = 0;
                    while (true) {
                        const b = buffer[offset++];
                        value |= (b & 0x7f) << shift;
                        if (!(b & 0x80)) break;
                        shift += 7;
                    }
                } else if (wireType === 2) { // Length-delimited (String, Bytes, Inner Message)
                    const len = buffer[offset++];
                    const sub = buffer.subarray(offset, offset + len);
                    offset += len;

                    // Recursive attempt for inner messages or strings
                    const subStr = sub.toString('utf-8');
                    if (/^[\x20-\x7E]+$/.test(subStr)) {
                        value = subStr;
                    } else {
                        value = `bin_${sub.length}_bytes`;
                    }
                } else {
                    // Skip unknown wire types
                    offset++;
                }

                // 🎯 DATA MAPPING (Heuristik)
                if (value !== undefined) {
                    const mappedKey = this.heuristicMap(fieldNumber, value);
                    result[mappedKey] = value;
                }
            }

            console.log(`[DECODER-RESULT] 🧩 Decoded Structure:`, JSON.stringify(result));
            return result;
        } catch (e) {
            return { raw_hex: buffer.toString('hex').substring(0, 100), error: 'PROTOBUF_DECODE_FAIL' };
        }
    }

    private heuristicMap(tag: number, value: any): string {
        // Mapping logic based on value characteristics
        if (typeof value === 'number') {
            if (value > 1.0 && value < 50.0) return `ODDS_${tag}`;
            if (value > 1000) return `TIMESTAMP_OR_ID_${tag}`;
        }
        if (typeof value === 'string') {
            if (value.length > 3 && value.length < 50) return `TEAM_OR_LEAGUE_${tag}`;
        }
        return `field_${tag}`;
    }

    private isBase64(str: string): boolean {
        if (str.length < 4) return false;
        const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
        return base64Regex.test(str);
    }

    /**
     * 🕵️ HEURISTIC MATCH DETECTOR
     * Analyzes payload to determine if it contains sportsbook match/odds data.
     */
    public getMatchDataConfidence(payload: any): { confidence: number; reason: string } {
        if (!payload) return { confidence: 0, reason: 'Empty payload' };

        const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const lower = str.toLowerCase();

        let score = 0;
        const indicators = [
            { patterns: ['matchid', 'eventid', 'fixtureid'], weight: 20, name: 'ID Patterns' },
            { patterns: ['homename', 'awayname', 'hteam', 'ateam', 'hometeam', 'awayteam'], weight: 30, name: 'Team Names' },
            { patterns: ['odds', 'price', 'displayodds', 'hdp', 'handicap', 'overunder', 'ou'], weight: 30, name: 'Odds Patterns' },
            { patterns: ['league', 'tournament', 'competition'], weight: 15, name: 'League Patterns' },
            { patterns: ['matchlist', 'eventlist', 'sportitems'], weight: 25, name: 'Structure Keywords' }
        ];

        let reasons = [];
        for (const ind of indicators) {
            if (ind.patterns.some(p => lower.includes(p))) {
                score += ind.weight;
                reasons.push(ind.name);
            }
        }

        // Contextual checks
        if (Array.isArray(payload) && payload.length > 5) score += 10;
        if (str.length > 1000) score += 5;

        return {
            confidence: Math.min(score, 100),
            reason: reasons.length > 0 ? `Detected: ${reasons.join(', ')}` : 'No strong indicators'
        };
    }
}
