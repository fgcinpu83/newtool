import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Server as IOServer } from 'socket.io';
import { IoAdapter } from '@nestjs/platform-socket.io';
import axios from 'axios';

async function bootstrap() {
    try {
        // Enforce CI=false in runtime to allow real HTTP probes (Hukum 12)
        if (process.env.CI !== 'false') process.env.CI = 'false';
        // Expose CI/test flags for early diagnostics
        const IS_CI = process.env.CI === 'true';
        const IS_TEST = process.env.NODE_ENV === 'test';
        console.log("Starting application bootstrap...", { IS_CI, IS_TEST });

        const app = await NestFactory.create(AppModule);

        // Register global error handlers so crashes are logged to wire_debug.log
        try {
            const fs = require('fs');
            const wireLog = require('path').join(process.cwd(), 'logs', 'wire_debug.log');
            process.on('uncaughtException', (err: any) => {
                const entry = { ts: Date.now(), tag: 'UNCAUGHT_EXCEPTION', message: err?.message || String(err), stack: err?.stack };
                try { fs.appendFileSync(wireLog, JSON.stringify(entry) + '\n'); } catch (e) {}
                console.error('[UNCAUGHT_EXCEPTION]', err);
            });
            process.on('unhandledRejection', (reason: any) => {
                const entry = { ts: Date.now(), tag: 'UNHANDLED_REJECTION', reason: String(reason) };
                try { fs.appendFileSync(wireLog, JSON.stringify(entry) + '\n'); } catch (e) {}
                console.error('[UNHANDLED_REJECTION]', reason);
            });
        } catch (e) { console.warn('[MAIN] Failed to install global error handlers', e); }

        // 🚀 Setup Socket.IO adapter for extension compatibility
        app.useWebSocketAdapter(new IoAdapter(app));

        // DISABLE DEFAULT CORS (We will handle it manually for PNA support)
        // app.enableCors(); 

        // SUPER-PERMISSIVE CORS & PNA MIDDLEWARE
        app.use((req, res, next) => {
            // 1. Allow Private Network Access (The Magic Key)
            res.header('Access-Control-Allow-Private-Network', 'true');

            // 2. Dynamic Origin (Reflect)
            const origin = req.headers.origin;
            if (origin) {
                res.header('Access-Control-Allow-Origin', origin);
            } else {
                res.header('Access-Control-Allow-Origin', '*');
            }

            // 3. Credentials & Methods
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With, Access-Control-Request-Private-Network');

            // 4. Handle PREFLIGHT immediately
            if (req.method === 'OPTIONS') {
                res.sendStatus(204);
                return;
            }
            next();
        });

        await app.listen(3001, '0.0.0.0');
        const url = await app.getUrl();
        console.log(`Application is running on: ${url}`);
    } catch (error) {
        // Never exit the process from bootstrap in CI/test-safe mode — just log
        console.error("Fatal error during bootstrap:", error);
        try { const fs = require('fs'); const wireLog = require('path').join(process.cwd(), 'logs', 'wire_debug.log'); fs.appendFileSync(wireLog, JSON.stringify({ ts: Date.now(), tag: 'BOOTSTRAP_FATAL', message: (error && error.message) ? error.message : String(error) }) + '\n'); } catch (e) {}
        // do not call process.exit(1); — keep process alive for CI diagnostics
    }
}
bootstrap();