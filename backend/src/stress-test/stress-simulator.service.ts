import { Injectable, Logger } from '@nestjs/common';
import { AppGateway } from '../gateway.module';
import { DiscoveryService } from '../discovery/discovery.service';
import { NormalizationService } from '../normalization/normalization.service';
import { CommandRouterService } from '../command/command-router.service';
import * as v8 from 'v8';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StressSimulatorService {
    private readonly logger = new Logger(StressSimulatorService.name);
    private isRunning = false;
    private timer: NodeJS.Timeout | null = null;
    private startTime = 0;
    private readonly DURATION_MS = 15 * 60 * 1000;
    private stats = {
        totalPackets: 0,
        malformedPackets: 0,
        syncSuccess: 0,
        syncFail: 0,
        wsDisconnects: 0
    };

    constructor(
        private gateway: AppGateway,
        private discovery: DiscoveryService,
        private normService: NormalizationService,
        private commandRouter: CommandRouterService
    ) { }

    onModuleInit() {
        this.commandRouter.register('START_STRESS', async () => { this.startSimulation(); });
        this.commandRouter.register('STOP_STRESS', async () => { this.stopSimulation(); });
    }

    async startSimulation() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.startTime = Date.now();
        this.resetStats();

        this.logger.log('🚀 UNLEASHING STRESS-PROD SIMULATION (15 Minutes)');
        this.logger.log('📊 Target: OpticOdds & SportsData.io Emulation');

        // Start Heap Monitoring (60s)
        const heapInterval = setInterval(() => {
            const heap = v8.getHeapStatistics();
            const usedMB = (heap.used_heap_size / 1024 / 1024).toFixed(2);
            const msg = `[MONITOR] Heap Memory: ${usedMB} MB / ${(heap.heap_size_limit / 1024 / 1024).toFixed(2)} MB`;
            this.logger.log(msg);
            this.logToDisk(msg);
            this.gateway.sendUpdate('stress_metrics', { type: 'HEAP', value: parseFloat(usedMB), ts: Date.now() });
        }, 60000);

        // WS Disconnect Simulation (3m)
        const wsInterval = setInterval(() => {
            this.stats.wsDisconnects++;
            const msg = '[ANOMALY] WebSocket Connection Dropped (Simulated)';
            this.logger.warn(msg);
            this.logToDisk(msg);
            this.gateway.sendUpdate('stress_anomaly', { type: 'WS_DROP', ts: Date.now() });
        }, 180000);

        // Data Generation Loop
        const runLoop = async () => {
            if (!this.isRunning || Date.now() - this.startTime > this.DURATION_MS) {
                this.stopSimulation();
                clearInterval(heapInterval);
                clearInterval(wsInterval);
                return;
            }

            // Generate 50 pairs with latency
            await this.generateBatch();

            // Random delay between batches
            const delay = Math.floor(Math.random() * 500) + 100;
            setTimeout(runLoop, delay);
        };

        runLoop();
    }

    private async generateBatch() {
        const teamPairs = this.getMockTeamPairs();

        for (const pair of teamPairs) {
            this.stats.totalPackets++;

            // 5% Malformed Injection
            const isMalformed = Math.random() < 0.05;
            if (isMalformed) {
                this.stats.malformedPackets++;
                this.discovery.registerMatch('A', 'MALFORMED', 'ERR_MALFORMED_{}'); // Send junk
                continue;
            }

            // Latency Simulation (50 - 2000ms)
            const latency = Math.floor(Math.random() * 1950) + 50;

            setTimeout(() => {
                const now = Date.now();

                // Account A: OpticOdds Format
                const dataA = {
                    provider: 'OpticOdds',
                    match: `${pair.home} vs ${pair.away}`,
                    odds: { home: (Math.random() * 1.5 + 1.8).toFixed(2), away: (Math.random() * 1.5 + 1.8).toFixed(2) },
                    ts: now - 100 // Pre-latency TS
                };

                // Account B: SportsData.io Format (Asian Prefixes)
                const prefix = ['MPO ', 'AFB ', 'CMD ', ''][Math.floor(Math.random() * 4)];
                const dataB = {
                    p: 'SportsData',
                    h: prefix + pair.home,
                    a: pair.away,
                    o: [(Math.random() * 1.5 + 1.8).toFixed(2), (Math.random() * 1.5 + 1.8).toFixed(2)],
                    time: now
                };

                // Processing
                this.discovery.registerMatch('A', 'OpticOdds', dataA);
                this.discovery.registerMatch('B', 'SportsData', dataB);

            }, latency);
        }
    }

    private stopSimulation() {
        this.isRunning = false;
        const duration = (Date.now() - this.startTime) / 1000;
        const summary = `🏁 STRESS TEST COMPLETE in ${duration}s | Summary: Total:${this.stats.totalPackets}, Malformed:${this.stats.malformedPackets}, WS_Drops:${this.stats.wsDisconnects}`;
        this.logger.log(summary);
        this.logToDisk(summary);
        this.gateway.sendUpdate('stress_result', this.stats);
    }

    private logToDisk(msg: string) {
        try {
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
            const logPath = path.join(logDir, 'wire_debug.log');
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] [STRESS-SIM] ${msg}\n`);
        } catch (e) { }
    }

    private resetStats() {
        this.stats = { totalPackets: 0, malformedPackets: 0, syncSuccess: 0, syncFail: 0, wsDisconnects: 0 };
    }

    private getMockTeamPairs() {
        // Return 50 team pairs
        const teams = ['Chelsea', 'Arsenal', 'Liverpool', 'Man City', 'Man Utd', 'Real Madrid', 'Barca', 'Bayern', 'PSG', 'Juve',
            'Inter', 'Milan', 'Dortmund', 'Ajax', 'Porto', 'Benfica', 'Napoli', 'Lazio', 'Roma', 'Atletico',
            'Valencia', 'Sevilla', 'Spurs', 'Everton', 'Leicester', 'Wolves', 'Newcastle', 'Villa', 'Leeds', 'West Ham',
            'Lyon', 'Marseille', 'Monaco', 'Lille', 'Nice', 'Rennes', 'Leverkusen', 'Leipzig', 'Gladbach', 'Wolfsburg',
            'Zenit', 'Spartak', 'CSKA', 'Galatasaray', 'Fenerbahce', 'Besiktas', 'Celtic', 'Rangers', 'Brugge', 'Anderlecht'];

        const pairs = [];
        for (let i = 0; i < 50; i++) {
            const home = teams[i % teams.length];
            const away = teams[(i + 1) % teams.length];
            pairs.push({ home, away });
        }
        return pairs;
    }
}
