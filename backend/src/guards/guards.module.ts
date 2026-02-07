/**
 * Guards Module v2.0 - CONSTITUTION COMPLIANT
 *
 * ChromeConnectionManager is provided by @Global() ChromeModule.
 * DILARANG register ulang di sini (would create duplicate instance).
 */
import { Module } from '@nestjs/common';
import { GlobalExecutionGuard } from './global-execution.guard';
import { ProviderSessionManager } from '../managers/provider-session.manager';

@Module({
    providers: [GlobalExecutionGuard, ProviderSessionManager],
    exports: [GlobalExecutionGuard],
})
export class GuardsModule {}