import { Module } from '@nestjs/common'
import { CommandRouterService } from './command-router.service'

@Module({
  providers: [CommandRouterService],
  exports: [CommandRouterService],
})
export class CommandModule {}
