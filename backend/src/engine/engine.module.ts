import { Module, forwardRef } from '@nestjs/common';
import { EngineService } from '../engine.service';
import { WorkerModule } from '../workers/worker.module';

@Module({
  imports: [forwardRef(() => WorkerModule)],
  providers: [EngineService],
  exports: [EngineService],
})
export class EngineModule {}
