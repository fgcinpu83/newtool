export interface ExecutionResult {
    GlobalEventID: string;
    MarketType: string;
    Line: number;

    FirstBet: {
        Provider: "A" | "B";
        Selection: string;
        Odds: number;
        Stake: number;
        Status: "ACCEPTED" | "REJECTED" | "FAILED";
        BetID?: string;
    };

    SecondBet?: {
        Provider: "A" | "B";
        Selection: string;
        Odds: number;
        Stake: number;
        Status: "ACCEPTED" | "REJECTED" | "FAILED" | "SKIPPED";
        BetID?: string;
    };

    FinalStatus: "SUCCESS" | "ABORTED" | "PARTIAL" | "FAILED" | "HEDGED";
    Timestamp: number;
}
