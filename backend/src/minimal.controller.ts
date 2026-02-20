import { Controller, Post, Body, Get } from '@nestjs/common';
import { EngineService } from './engine.service';
import { BrowserAutomationService } from './workers/browser.automation';

@Controller('api')
export class MinimalController {
  constructor(private readonly engine: EngineService, private readonly browser: BrowserAutomationService) {}

  @Post('set-url')
  async setUrl(@Body() body: { account: 'A' | 'B'; url: string }): Promise<any> {
    const acc = body && body.account === 'B' ? 'B' : 'A';
    const url = String(body && body.url ? body.url : '');
    await this.engine.setUrl(acc as 'A' | 'B', url);
    return { success: true, state: JSON.parse(JSON.stringify(this.engine.getState())) };
  }

  @Post('toggle')
  async toggle(
    @Body() body: { account: 'A' | 'B'; active: boolean }
  ): Promise<any> {

    if (!body || (body.account !== 'A' && body.account !== 'B')) {
      return { success: false, error: 'INVALID_ACCOUNT' };
    }

    const acc = body.account;
    const active = Boolean(body.active);

    try {
      if (active) {
        await this.engine.toggleOn(acc);
      } else {
        await this.engine.toggleOff(acc);
      }

      return {
        success: true,
        state: this.engine.getState()
      };
    } catch (err: any) {
      console.error('[MINIMAL_CTRL] toggle error:', err && err.message ? err.message : String(err));
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  @Get('backend-state')
  async getState(): Promise<any> {
    return { success: true, state: JSON.parse(JSON.stringify(this.engine.getState())) };
  }

  @Get('flow-diagnostics')
  async flowDiagnostics(): Promise<any> {
    // deterministic diagnostics for operators
    return JSON.parse(JSON.stringify(this.engine.getState()));
  }

  @Get('system-health')
  async systemHealth(): Promise<any> {
    try {
      return { success: true, health: this.engine.getSystemHealth() };
    } catch (e) {
      return { success: false, error: (e && (e as Error).message) || String(e) };
    }
  }

  // Compatibility endpoint (replaces removed FastAPI `/api/system/state`)
  @Get('system/state')
  async systemState(): Promise<any> {
    try {
      return this.engine.getState();
    } catch (e) {
      return { error: (e && (e as Error).message) || String(e) };
    }
  }
}
