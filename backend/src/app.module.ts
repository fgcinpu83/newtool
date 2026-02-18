import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GatewayModule } from './gateway.module';
import { MinimalDebugController } from './debug/minimal.controller';
import { MinimalController } from './minimal.controller';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        GatewayModule,
    ],
    controllers: [MinimalDebugController, MinimalController],
    providers: [],
})
export class AppModule { }
