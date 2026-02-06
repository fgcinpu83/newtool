import { Module } from '@nestjs/common';
import { StressSimulatorService } from './stress-simulator.service';
import { DiscoveryModule } from '../discovery/discovery.module';
import { NormalizationModule } from '../normalization/normalization.module';
import { GatewayModule } from '../gateway.module';

@Module({
    imports: [DiscoveryModule, NormalizationModule, GatewayModule],
    providers: [StressSimulatorService],
    exports: [StressSimulatorService]
})
export class StressTestModule { }
