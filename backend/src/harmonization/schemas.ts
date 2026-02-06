import { MarketType } from "../normalization/schemas";

export interface HarmonizedMarket {
    GlobalEventID: string;
    MarketType: MarketType;
    Line: number;

    ProviderA: {
        HOME?: number;
        AWAY?: number;
        OVER?: number;
        UNDER?: number;
    };

    ProviderB: {
        HOME?: number;
        AWAY?: number;
        OVER?: number;
        UNDER?: number;
    };
}
