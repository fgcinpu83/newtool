import { Module, forwardRef } from '@nestjs/common';
import { MarketService } from './market.service';
import { GatewayModule } from '../gateway.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { NormalizationModule } from '../normalization/normalization.module';

@Module({
    imports: [GatewayModule, NormalizationModule, DiscoveryModule],
    providers: [MarketService],
    exports: [MarketService],
})
export class MarketModule { }
