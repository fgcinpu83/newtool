import { Controller, Post, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { CommandRouterService } from '../command/command-router.service';
import { WorkerService } from '../workers/worker.service';
import { InternalEventBusService } from '../events/internal-event-bus.service';

@Controller('api/debug')
export class TestController {
    constructor(private readonly commandRouter: CommandRouterService, private readonly workerService: WorkerService, private readonly internalBus: InternalEventBusService) {}

    @Post('simulate-toggle')
    @HttpCode(HttpStatus.OK)
    async simulateToggle(@Body() body: { account: 'A' | 'B'; active: boolean }) {
        const { account, active } = body || { account: 'A', active: true };
        const cmd = { type: 'TOGGLE_ACCOUNT', payload: { account, active } };
        try {
            await this.commandRouter.route(cmd as any);
            return { success: true, message: `Simulated TOGGLE_ACCOUNT ${account} -> ${active}` };
        } catch (err: any) {
            return { success: false, error: err && err.message ? err.message : String(err) };
        }
    }

    @Post('simulate-update-config')
    @HttpCode(HttpStatus.OK)
    async simulateUpdateConfig(@Body() body: any) {
        const payload = body || {};
        const cmd = { type: 'UPDATE_CONFIG', payload };
        try {
            await this.commandRouter.route(cmd as any);
            return { success: true, message: 'Simulated UPDATE_CONFIG', payload };
        } catch (err: any) {
            return { success: false, error: err && err.message ? err.message : String(err) };
        }
    }

    @Post('simulate-open-browser')
    @HttpCode(HttpStatus.OK)
    async simulateOpenBrowser(@Body() body: { account: 'A' | 'B'; url: string }) {
        const payload = body || { account: 'A', url: '' };
        const cmd = { type: 'OPEN_BROWSER', payload };
        try {
            await this.commandRouter.route(cmd as any);
            return { success: true, message: `Simulated OPEN_BROWSER ${payload.account} -> ${payload.url}` };
        } catch (err: any) {
            return { success: false, error: err && err.message ? err.message : String(err) };
        }
    }

    @Post('publish-internal')
    @HttpCode(HttpStatus.OK)
    async publishInternal(@Body() body: { type: string; payload?: any }) {
        const { type, payload } = body || {} as any;
        if (!type) return { success: false, error: 'Missing event type' };
        try {
            this.internalBus.publish(type, payload);
            return { success: true, message: `Published internal event ${type}` };
        } catch (err: any) {
            return { success: false, error: err && err.message ? err.message : String(err) };
        }
    }

    @Get('backend-state')
    @HttpCode(HttpStatus.OK)
    async backendState() {
        try {
            // runtimeManager.getAll() returns AccountRuntime objects with getState()
            const all = (this.workerService as any).runtimeManager.getAll() || [];
            const accounts = all.map((r: any) => ({ accountId: r.accountId, fsm: r.getState() }));
            return { success: true, accounts };
        } catch (err: any) {
            return { success: false, error: err && err.message ? err.message : String(err) };
        }
    }
}

