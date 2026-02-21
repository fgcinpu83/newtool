import { Module } from '@nestjs/common';
import { WorkerModule } from './workers/worker.module';
import { GatewayModule } from './gateway/gateway.module';
import { EngineModule } from './engine/engine.module';

@Module({
    imports: [WorkerModule, EngineModule, GatewayModule],
})
export class AppModule {}
