export interface ArbitrageOpportunity {
    GlobalEventID: string;
    MarketType: string;
    Line: number;

    SideA: {
        Provider: "A" | "B";
        Selection: "HOME" | "AWAY" | "OVER" | "UNDER";
        Odds: number;
        Stake: number;
    };

    SideB: {
        Provider: "A" | "B";
        Selection: "HOME" | "AWAY" | "OVER" | "UNDER";
        Odds: number;
        Stake: number;
    };

    TotalProbability: number;
    ExpectedProfitPercent: number;
}
