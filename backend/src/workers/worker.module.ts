import { Module, forwardRef } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { EngineModule } from '../engine/engine.module';
import { BrowserAutomationService } from './browser.automation';

@Module({
  imports: [forwardRef(() => EngineModule)],
  providers: [WorkerService, BrowserAutomationService],
  exports: [WorkerService, BrowserAutomationService],
})
export class WorkerModule {}
