import { Module, forwardRef } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';
import { GatewayModule } from '../gateway.module';
import { WorkerModule } from '../workers/worker.module';

@Module({
    imports: [GatewayModule, forwardRef(() => WorkerModule)],
    providers: [ArbitrageService],
    exports: [ArbitrageService],
})
export class ArbitrageModule { }
