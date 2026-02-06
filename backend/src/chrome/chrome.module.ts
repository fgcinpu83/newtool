import { Module } from '@nestjs/common';
import { ChromeController } from './chrome.controller';

@Module({
    controllers: [ChromeController],
})
export class ChromeModule {}
