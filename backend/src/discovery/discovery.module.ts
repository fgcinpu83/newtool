import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { GatewayModule } from '../gateway.module';
import { NormalizationModule } from '../normalization/normalization.module';

@Module({
    imports: [GatewayModule, NormalizationModule],
    providers: [DiscoveryService],
    exports: [DiscoveryService],
})
export class DiscoveryModule { }
