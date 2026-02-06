import { SabaExecutionService } from './saba-execution.service';

export async function betOnB(details: any, sabaService?: SabaExecutionService): Promise<any> {
    // 1. Check if this is a Saba/ISPORT bet
    // details.ProviderName or details.Provider could be used to identify
    if (sabaService && (details.ProviderName === 'ISPORT' || details.Bookmaker === 'ISPORT')) {
        try {
            console.log(`[EXECUTION] Routing bet to SABA service for ${details.Stake}`);
            return await sabaService.processBet({
                Matchid: details.Matchid || details.matchId,
                Oddsid: details.Oddsid || details.oddsId,
                Odds: details.Odds,
                Stake: details.Stake,
                sinfo: details.sinfo || 'NONE', // Should be captured from browser
                AcceptBetterOdds: details.AcceptBetterOdds
            });
        } catch (err) {
            console.error(`[SABA-EXEC] Error in betOnB: ${err.message}`);
            return { Status: "FAILED", Error: err.message };
        }
    }

    // SHADOW MODE: MOCK fallback
    console.log(`[SHADOW_EXECUTION_BLOCKED] blocked real bet on B for ${details.Stake} @ ${details.Odds}`);
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                Provider: "B",
                Selection: details.Selection,
                Odds: details.Odds,
                Stake: details.Stake,
                Status: "ACCEPTED", // Simulate success
                BetID: "BET_B_" + Date.now()
            });
        }, 500);
    });
}
