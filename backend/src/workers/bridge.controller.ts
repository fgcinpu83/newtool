import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppGateway } from '../gateway.module';

/**
 * HTTP Controller for Extension Bridge
 * Provides REST endpoints as fallback for WebSocket
 */
@Controller()
export class BridgeController {
    constructor(private readonly gateway: AppGateway) { }

    @Get('health')
    getHealth(@Res() res: Response) {
        console.log('[BRIDGE-HTTP] Health check received');
        res.status(200).json({
            status: 'ok',
            timestamp: Date.now(),
            clients: (this.gateway.server as any)?.clients?.size || 0
        });
    }

    @Post('capture')
    handleCapture(@Body() body: any, @Res() res: Response) {
        console.log(`[BRIDGE-HTTP] Capture received: type=${body.type} account=${body.account} provider=${body.provider}`);

        if (!body || !body.type) {
            res.status(400).json({ error: 'Invalid payload' });
            return;
        }

        // Emit to the same event bus as WebSocket
        this.gateway.commandEvents.emit('endpoint_captured', {
            account: body.account,
            provider: body.provider,
            type: body.type,
            data: body.data,
            timestamp: body.timestamp || Date.now()
        });

        res.status(200).json({ status: 'received', type: body.type });
    }
}
