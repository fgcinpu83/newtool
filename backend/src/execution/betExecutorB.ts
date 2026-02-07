/**
 * Bet Executor B v2.0 — CONSTITUTION §III.3 COMPLIANT
 *
 * Guard is enforced at the engine level (executeArbitrage → validateExecution).
 * betOnB itself does NOT re-check guard — the engine is the single gate.
 * processBet() is called through safePlaceBet() for slip verification.
 */

import { SabaExecutionService } from './saba-execution.service';

export async function betOnB(details: any, sabaService?: SabaExecutionService): Promise<any> {
    // Route to SABA if service available and provider is ISPORT
    if (sabaService && (details.ProviderName === 'ISPORT' || details.Bookmaker === 'ISPORT')) {
        try {
            console.log(`[EXECUTION] Routing bet to SABA safePlaceBet for ${details.Stake}`);
            return await sabaService.safePlaceBet({
                Matchid: details.Matchid || details.matchId,
                Oddsid: details.Oddsid || details.oddsId,
                Odds: details.Odds,
                Stake: details.Stake,
                sinfo: details.sinfo || 'NONE',
                AcceptBetterOdds: details.AcceptBetterOdds,
            });
        } catch (err) {
            console.error(`[SABA-EXEC] Error in betOnB: ${err.message}`);
            return { Status: 'FAILED', Error: err.message };
        }
    }

    // SHADOW MODE: MOCK fallback for non-ISPORT providers
    console.log(`[SHADOW_EXECUTION_BLOCKED] blocked real bet on B for ${details.Stake} @ ${details.Odds}`);
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                Provider: 'B',
                Selection: details.Selection,
                Odds: details.Odds,
                Stake: details.Stake,
                Status: 'ACCEPTED',
                BetID: 'BET_B_' + Date.now(),
            });
        }, 500);
    });
}
