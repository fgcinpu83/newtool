import { Module } from '@nestjs/common';
import { WorkerModule } from './workers/worker.module';
import { GatewayModule } from './gateway/gateway.module';
import { EngineModule } from './engine/engine.module';
import { ChromeModule } from './chrome/chrome.module';
import { SystemController } from './system/system.controller';

@Module({
    imports: [WorkerModule, EngineModule, GatewayModule, ChromeModule],
    controllers: [SystemController],
})
export class AppModule {}
