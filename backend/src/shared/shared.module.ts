import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { UniversalDecoderService } from './decoder.service';
import { ContractRegistry } from '../workers/contract-registry.service';
import { SqliteService } from './sqlite.service';
import { InternalEventBusService } from '../events/internal-event-bus.service';

@Global()
@Module({
    providers: [RedisService, UniversalDecoderService, ContractRegistry, SqliteService, InternalEventBusService],
    exports: [RedisService, UniversalDecoderService, ContractRegistry, SqliteService, InternalEventBusService],
})
export class SharedModule { }
