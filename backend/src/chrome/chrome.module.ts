import { Module } from '@nestjs/common';
import { ChromeController } from './chrome.controller';
import { ChromeConnectionManager } from '../managers/chrome-connection.manager';

@Module({
    controllers: [ChromeController],
    providers: [ChromeConnectionManager],
    exports: [ChromeConnectionManager]
})
export class ChromeModule {}
