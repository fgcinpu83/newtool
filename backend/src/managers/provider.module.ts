/**
 * ProviderModule — CONSTITUTION COMPLIANT
 *
 * SYSTEM CONSTITUTION §III.2:
 * - ProviderSessionManager is the SINGLE source of truth for providers
 * - @Global() ensures ONE instance across the entire app (singleton)
 * - All modules that need provider access get it from here
 *
 * DILARANG register ProviderSessionManager di module lain.
 */

import { Global, Module } from '@nestjs/common';
import { ProviderSessionManager } from './provider-session.manager';

@Global()
@Module({
    providers: [ProviderSessionManager],
    exports: [ProviderSessionManager],
})
export class ProviderModule {}
