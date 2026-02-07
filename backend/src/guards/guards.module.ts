/**
 * Guards Module v2.0 - CONSTITUTION COMPLIANT
 *
 * ChromeConnectionManager is provided by @Global() ChromeModule.
 * ProviderSessionManager is provided by @Global() ProviderModule.
 * DILARANG register ulang di sini (would create duplicate instance).
 */
import { Module } from '@nestjs/common';
import { GlobalExecutionGuard } from './global-execution.guard';

@Module({
    providers: [GlobalExecutionGuard],
    exports: [GlobalExecutionGuard],
})
export class GuardsModule {}