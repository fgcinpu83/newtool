import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GatewayModule } from './gateway.module';
import { MinimalDebugController } from './debug/minimal.controller';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        GatewayModule,
    ],
    controllers: [MinimalDebugController],
    providers: [],
})
export class AppModule { }
