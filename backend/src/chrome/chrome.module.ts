/**
 * ChromeModule - CONSTITUTION COMPLIANT
 *
 * SYSTEM CONSTITUTION §III.1:
 * - ChromeConnectionManager is the SINGLE source of truth for Chrome
 * - @Global() ensures ONE instance across the entire app (singleton)
 * - All modules that need Chrome access import this module
 */

import { Global, Module } from '@nestjs/common';
import { ChromeController } from './chrome.controller';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';

@Global()
@Module({
    controllers: [ChromeController],
    providers: [ChromeConnectionManager],
    exports: [ChromeConnectionManager],
})
export class ChromeModule {}
