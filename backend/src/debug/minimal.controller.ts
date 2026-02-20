import { Controller, Post, Body, Get } from '@nestjs/common';
import { EngineService } from '../engine.service';
import { BrowserAutomationService } from '../workers/browser.automation';
import { WorkerService } from '../workers/worker.service';

@Controller('api/debug')
export class MinimalDebugController {
  constructor(private readonly engine: EngineService, private readonly browser: BrowserAutomationService, private readonly worker: WorkerService) {}

  @Post('simulate-update-config')
  simulateUpdateConfig(@Body() body: { account: string; url: string }): any {
    const acc = (String(body.account || 'A').toUpperCase() === 'B') ? 'B' : 'A';
    this.engine.setUrl(acc as 'A' | 'B', String(body.url || ''));
    return { success: true, state: { accounts: JSON.parse(JSON.stringify(this.engine.getState())) } };
  }

  @Post('simulate-toggle')
  async simulateToggle(@Body() body: { account: string; active: boolean }): Promise<any> {
    const acc = (String(body.account || 'A').toUpperCase() === 'B') ? 'B' : 'A';
    try {
      console.log(`[DEBUG_CTRL] simulateToggle called for ${acc} active=${Boolean(body.active)}`);
      await this.engine.toggle(acc as 'A' | 'B', Boolean(body.active));
      console.log(`[DEBUG_CTRL] simulateToggle returned for ${acc}`);
      return { success: true, state: { accounts: JSON.parse(JSON.stringify(this.engine.getState())) } };
    } catch (err: any) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  @Get('backend-state')
  backendState(): any {
    return { success: true, state: { accounts: JSON.parse(JSON.stringify(this.engine.getState())) } };
  }

  @Post('open-browser')
  async openBrowser(@Body() body: { account: string; url: string }): Promise<any> {
    const acc = (String(body.account || 'A').toUpperCase() === 'B') ? 'B' : 'A';
    const url = String(body.url || '');
    try {
      console.log(`[DEBUG_CTRL] openBrowser invoke ${acc} ${url}`);
      const res = await this.browser.openBrowser(acc as 'A'|'B', url);
      console.log(`[DEBUG_CTRL] openBrowser result: ${JSON.stringify(res)}`);
      return { success: true, result: res };
    } catch (err: any) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  @Post('simulate-bind')
  simulateBind(@Body() body: { account: string; targetId?: string }): any {
    const acc = (String(body.account || 'A').toUpperCase() === 'B') ? 'B' : 'A';
    const targetId = String(body.targetId || `SIM-${Math.random().toString(36).slice(2,10).toUpperCase()}`);
    // Force a browserSession into EngineService for test purposes
    try {
      const state = (this.engine as any).getState();
      (state[acc] as any).browserSession = { port: 9222, targetId, url: (state[acc] as any).url || null };
      // Replace the WorkerService internal accounts snapshot so summaries reflect binding
      this.worker.replaceState(state);
      return { success: true, state: { accounts: JSON.parse(JSON.stringify(this.engine.getState())) } };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  @Post('simulate-provider-marked')
  simulateProviderMarked(@Body() body: { account: string }): any {
    const acc = (String(body.account || 'A').toUpperCase() === 'B') ? 'B' : 'A';
    try {
      this.engine.providerMarked(acc as 'A' | 'B');
      return { success: true, state: JSON.parse(JSON.stringify(this.engine.getState())) };
    } catch (e: any) {
      return { success: false, error: e && e.message ? e.message : String(e) };
    }
  }

  @Post('simulate-stream')
  simulateStream(@Body() body: { account: string; targetId?: string; rate?: number }): any {
    const acc = (String(body.account || 'A').toUpperCase() === 'B') ? 'B' : 'A';
    const payload = { targetId: body.targetId, rate: body.rate };
    try {
      this.engine.streamDetected(acc as 'A' | 'B', payload as any);
      return { success: true, state: { accounts: JSON.parse(JSON.stringify(this.engine.getState())) } };
    } catch (e: any) {
      return { success: false, error: e && e.message ? e.message : String(e) };
    }
  }
}
