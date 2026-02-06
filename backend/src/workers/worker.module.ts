import { Module, forwardRef } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { WorkerController } from './worker.controller';
import { BridgeController } from './bridge.controller';
import { MarketModule } from '../market/market.module';
import { GatewayModule } from '../gateway.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { PairingModule } from '../pairing/pairing.module';
import { GuardianModule } from '../guardian/guardian.module';
import { BrowserAutomationService } from './browser.automation';
import { SharedModule } from '../shared/shared.module';

import { ContractRegistry } from './contract-registry.service';
import { WorkerManager } from './worker.manager';
import { AfbWorker } from './afb.worker';
import { CmdWorker } from './cmd.worker';

@Module({
    imports: [forwardRef(() => MarketModule), GatewayModule, DiscoveryModule, PairingModule, GuardianModule, SharedModule],
    controllers: [WorkerController, BridgeController],
    providers: [WorkerService, BrowserAutomationService, WorkerManager, AfbWorker, CmdWorker],
    exports: [WorkerService, WorkerManager, AfbWorker, CmdWorker],
})
export class WorkerModule { }
