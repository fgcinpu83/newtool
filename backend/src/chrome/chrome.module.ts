/**
 * ChromeModule v4.0 — CONSTITUTION §III.1 + STEP 3.1 + STEP 3.2 + STEP 3.3
 *
 * - ChromeConnectionManager: SINGLE source of truth for Chrome HTTP state
 * - ChromeLauncher: SINGLE way to spawn Chrome processes
 * - CDPSessionManager: SINGLE source of truth for CDP WebSocket sessions
 * - ActiveTabManager: SINGLE source of truth for active tab per port
 * - @Global() ensures ONE instance across the entire app (singleton)
 */

import { Global, Module } from '@nestjs/common';
import { ChromeController } from './chrome.controller';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';
import { ChromeLauncher } from './chrome-launcher.service';
import { CDPSessionManager } from '../managers/cdp-session.manager';
import { ActiveTabManager } from '../managers/active-tab.manager';

@Global()
@Module({
    controllers: [ChromeController],
    providers: [ChromeLauncher, ChromeConnectionManager, CDPSessionManager, ActiveTabManager],
    exports: [ChromeLauncher, ChromeConnectionManager, CDPSessionManager, ActiveTabManager],
})
export class ChromeModule {}
