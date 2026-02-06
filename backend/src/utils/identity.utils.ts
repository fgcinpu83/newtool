import { v5 as uuidv5 } from 'uuid';

export class IdentityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DataIntegrityError';
    }
}

export class EventIdentity {
    /**
     * Standardized Namespace UUID for canonical fingerprinting
     * @see ADR-005
     */
    public static readonly NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

    /**
     * Normalizes text by converting to lowercase and removing all non-alphanumeric characters.
     * Example: "Man. Utd" -> "manutd"
     */
    public static normalize(text: string): string {
        if (!text) return '';
        return text.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    /**
     * Generates a deterministic UUID v5 fingerprint based on match parameters.
     * Seed format: ${sport}|${isoDate}|${normalizedHome}|${normalizedAway}
     */
    public static generateFingerprint(sport: string, isoDate: string, home: string, away: string): string {
        if (!sport || !isoDate || !home || !away) {
            throw new IdentityError(`Incomplete data for fingerprint generation: sport=${sport}, date=${isoDate}, home=${home}, away=${away}`);
        }

        // 🛡️ Ensure date is just the date-time part if it contains excessive precision or Z variations
        // But for consistency we trust the ISO string format as passed.
        const seed = `${sport.toLowerCase()}|${isoDate}|${this.normalize(home)}|${this.normalize(away)}`;

        return uuidv5(seed, this.NAMESPACE);
    }
}
