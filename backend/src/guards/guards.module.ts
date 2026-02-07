/**
 * Guards Module v3.0 — CONSTITUTION §III.3 COMPLIANT
 *
 * @Global() so GlobalExecutionGuard is available to ALL modules without explicit import.
 * ChromeConnectionManager is provided by @Global() ChromeModule.
 * ProviderSessionManager is provided by @Global() ProviderModule.
 * DILARANG register ulang di sini (would create duplicate instance).
 */
import { Module, Global } from '@nestjs/common';
import { GlobalExecutionGuard } from './global-execution.guard';

@Global()
@Module({
    providers: [GlobalExecutionGuard],
    exports: [GlobalExecutionGuard],
})
export class GuardsModule {}