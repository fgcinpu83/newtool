import { Module } from '@nestjs/common';
import { ProviderGuardianService } from './provider-guardian.service';
import { GatewayModule } from '../gateway.module';
import { DiscoveryModule } from '../discovery/discovery.module';

@Module({
    imports: [GatewayModule, DiscoveryModule],
    providers: [ProviderGuardianService],
    exports: [ProviderGuardianService],
})
export class GuardianModule { }
