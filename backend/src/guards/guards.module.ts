import { Module } from '@nestjs/common';
import { GlobalExecutionGuard } from './global-execution.guard';
import { ProviderSessionManager } from '../managers/provider-session.manager';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';

@Module({
    providers: [GlobalExecutionGuard, ProviderSessionManager, ChromeConnectionManager],
    exports: [GlobalExecutionGuard]
})
export class GuardsModule {}