export type MarketType = "FT_HDP" | "FT_OU" | "HT_HDP" | "HT_OU";
export type Selection = "HOME" | "AWAY" | "OVER" | "UNDER";

export interface NormalizedMarket {
    GlobalEventID: string;
    MarketType: MarketType;
    Line: number | null;
    Selection: Selection;
    Odds: number;
    Provider: string;
}