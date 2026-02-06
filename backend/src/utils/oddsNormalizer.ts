/**
 * ODDS NORMALIZER UTILITY
 * Single source of truth for Hongkong → Decimal odds conversion
 * 
 * Hongkong Odds:
 *   - Positive (e.g., 1.09): Profit on 1 unit stake → Decimal = HK + 1
 *   - Negative (e.g., -1.21): Amount to stake to win 1 unit → Decimal = 1 + (1/|HK|)
 * 
 * Decimal Odds:
 *   - Always >= 1.01
 *   - Represents total return including stake
 */

export function toDecimalOdds(raw: number | string): number | null {
    const o = typeof raw === 'string' ? parseFloat(raw) : raw;

    if (isNaN(o) || o === 0) {
        return null;
    }

    let decimal: number;

    if (o >= 0) {
        // Positive HK odds: profit on 1 unit stake
        // Decimal = HK + 1
        decimal = o + 1;
    } else {
        // Negative HK odds: stake needed to win 1 unit
        // Decimal = 1 + (1 / |HK|)
        decimal = 1 + (1 / Math.abs(o));
    }

    // Sanity check: Decimal odds must be >= 1.01
    if (decimal < 1.01) {
        return null;
    }

    return +decimal.toFixed(4);
}

/**
 * Validate that odds are in proper decimal format
 * Returns true only if odds >= 1.01
 */
export function isValidDecimalOdds(odds: number): boolean {
    return typeof odds === 'number' && !isNaN(odds) && odds >= 1.01;
}

/**
 * Calculate arbitrage profit percentage from decimal odds
 * Returns null if odds are invalid
 */
export function calculateArbitrageProfit(oddsA: number, oddsB: number): number | null {
    if (!isValidDecimalOdds(oddsA) || !isValidDecimalOdds(oddsB)) {
        return null;
    }

    const implied = (1 / oddsA) + (1 / oddsB);
    const profit = (1 - implied) * 100;

    return +profit.toFixed(4);
}
