/**
 * ChromeModule v3.0 — CONSTITUTION §III.1 + STEP 3.1 + STEP 3.2
 *
 * - ChromeConnectionManager: SINGLE source of truth for Chrome HTTP state
 * - ChromeLauncher: SINGLE way to spawn Chrome processes
 * - CDPSessionManager: SINGLE source of truth for CDP WebSocket sessions
 * - @Global() ensures ONE instance across the entire app (singleton)
 */

import { Global, Module } from '@nestjs/common';
import { ChromeController } from './chrome.controller';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';
import { ChromeLauncher } from './chrome-launcher.service';
import { CDPSessionManager } from '../managers/cdp-session.manager';

@Global()
@Module({
    controllers: [ChromeController],
    providers: [ChromeLauncher, ChromeConnectionManager, CDPSessionManager],
    exports: [ChromeLauncher, ChromeConnectionManager, CDPSessionManager],
})
export class ChromeModule {}
