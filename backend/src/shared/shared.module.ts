import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CDPBridgeService } from './cdp-bridge.service';
import { UniversalDecoderService } from './decoder.service';
import { ContractRegistry } from '../workers/contract-registry.service';

@Global()
@Module({
    providers: [RedisService, CDPBridgeService, UniversalDecoderService, ContractRegistry],
    exports: [RedisService, CDPBridgeService, UniversalDecoderService, ContractRegistry],
})
export class SharedModule { }
