import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkerModule } from './workers/worker.module';
import { ArbitrageModule } from './arbitrage/arbitrage.module';
import { MarketModule } from './market/market.module';
import { GatewayModule } from './gateway.module';
import { SharedModule } from './shared/shared.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { NormalizationModule } from './normalization/normalization.module';
import { PairingModule } from './pairing/pairing.module';
import { HealthMonitorService } from './health/health.monitor';
import { DevParseController } from './dev/dev.controller';
import { GuardianModule } from './guardian/guardian.module';
import { StressTestModule } from './stress-test/stress-test.module';
import { FinancialModule } from './financial/financial.module';
import { ChromeModule } from './chrome/chrome.module';

import { ProviderGuardianService } from './guardian/provider-guardian.service'; // Keep import if used by HealthMonitor but better just import Logic
import { ChromeConnectionManager } from './managers/chrome-connection.manager';
import { ProviderSessionManager } from './managers/provider-session.manager';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        SharedModule,
        WorkerModule,
        ArbitrageModule,
        MarketModule,
        GatewayModule,
        DiscoveryModule,
        NormalizationModule,
        PairingModule,
        GuardianModule,
        StressTestModule,
        FinancialModule,
        ChromeModule
    ],
    controllers: [DevParseController],
    providers: [HealthMonitorService, ChromeConnectionManager, ProviderSessionManager],
})
export class AppModule { }
