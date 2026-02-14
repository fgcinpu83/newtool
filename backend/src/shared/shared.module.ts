import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { UniversalDecoderService } from './decoder.service';
import { ContractRegistry } from '../workers/contract-registry.service';
import { SqliteService } from './sqlite.service';

@Global()
@Module({
    providers: [RedisService, UniversalDecoderService, ContractRegistry, SqliteService],
    exports: [RedisService, UniversalDecoderService, ContractRegistry, SqliteService],
})
export class SharedModule { }
