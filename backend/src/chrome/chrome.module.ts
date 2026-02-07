/**
 * ChromeModule v2.0 — CONSTITUTION §III.1 + STEP 3.1
 *
 * - ChromeConnectionManager: SINGLE source of truth for Chrome state
 * - ChromeLauncher: SINGLE way to spawn Chrome processes
 * - @Global() ensures ONE instance across the entire app (singleton)
 */

import { Global, Module } from '@nestjs/common';
import { ChromeController } from './chrome.controller';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';
import { ChromeLauncher } from './chrome-launcher.service';

@Global()
@Module({
    controllers: [ChromeController],
    providers: [ChromeLauncher, ChromeConnectionManager],
    exports: [ChromeLauncher, ChromeConnectionManager],
})
export class ChromeModule {}
