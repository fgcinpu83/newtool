import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { parseProvider } from '../contracts';

@Controller('dev')
export class DevParseController {
    @Post('parse')
    parse(@Body() body: any, @Res() res: Response) {
        try {
            const provider = (body.provider || '').toString().toUpperCase();
            const payload = body.payload || body.data || body;
            const result = parseProvider(provider, payload);
            return res.status(200).json({ ok: true, provider, parsed: result });
        } catch (err) {
            return res.status(500).json({ ok: false, error: String(err) });
        }
    }
}
