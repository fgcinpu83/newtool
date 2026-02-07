import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { UniversalDecoderService } from './decoder.service';
import { ContractRegistry } from '../workers/contract-registry.service';

@Global()
@Module({
    providers: [RedisService, UniversalDecoderService, ContractRegistry],
    exports: [RedisService, UniversalDecoderService, ContractRegistry],
})
export class SharedModule { }
