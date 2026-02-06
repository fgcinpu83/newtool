import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Server as IOServer } from 'socket.io';
import { IoAdapter } from '@nestjs/platform-socket.io';
import axios from 'axios';

async function bootstrap() {
    try {
        console.log("Starting application bootstrap...");
        const app = await NestFactory.create(AppModule);

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
        console.error("Fatal error during bootstrap:", error);
        process.exit(1);
    }
}
bootstrap();