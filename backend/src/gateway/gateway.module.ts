import { Module, forwardRef } from '@nestjs/common';
import { AppGateway } from './gateway';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [forwardRef(() => EngineModule)],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class GatewayModule {}
