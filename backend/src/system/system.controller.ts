import { Controller, Post, Body, Get } from '@nestjs/common';
import { EngineService } from '../engine.service';
import { AppGateway } from '../gateway/gateway';

@Controller('api')
export class SystemController {
  constructor(
    private readonly engine: EngineService,
    private readonly gateway: AppGateway,
  ) {}

  @Post('set-url')
  setUrl(@Body() body: { account: 'A' | 'B'; url: string }) {
    this.engine.setUrl(body.account, body.url);
    this.gateway.broadcastState();
    return { ok: true };
  }

  @Post('toggle')
  // frontend-driven contract: `active` boolean, not `enabled`
  toggle(@Body() body: { account: 'A' | 'B'; active: boolean }) {
    if (body.active) {
      this.engine.toggleOn(body.account);
    } else {
      this.engine.toggleOff(body.account);
    }
    this.gateway.broadcastState();
    return { ok: true };
  }

  // legacy path used by frontend
  @Get('backend-state')
  getStateAlias() {
    return this.engine.getState();
  }

  @Get('system/state')
  getState() {
    return this.engine.getState();
  }

  @Get('logs')
  getLogs() {
    // stubbed log endpoint; frontend polls this every few seconds.
    return [];
  }
}
