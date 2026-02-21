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
  async toggle(@Body() body: { account: 'A' | 'B'; active: boolean }) {
    try {
      if (body.active) {
        await this.engine.toggleOn(body.account);
      } else {
        await this.engine.toggleOff(body.account);
      }
    } catch (e: any) {
      // emit structured system_log so UI / monitoring can surface the error
      const msg = e && e.message ? e.message : String(e);
      this.gateway.server.emit('system_log', { level: 'error', message: `toggle failed: ${msg}` });
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
