#!/usr/bin/env node

/**
 * 🔍 ANTIGRAVITY DEBUG SENSORS v1.0
 * ================================
 * Comprehensive pipeline monitoring from Provider → Backend → UI
 *
 * Usage: node debug_sensors.js
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

class DebugSensors {
    constructor() {
        this.startTime = Date.now();
        this.captureCount = 0;
        this.backendEvents = 0;
        this.uiUpdates = 0;
        this.errors = [];
        this.pipeline = {
            provider: { status: 'unknown', lastActivity: null, captures: 0 },
            backend: { status: 'unknown', lastActivity: null, events: 0 },
            ui: { status: 'unknown', lastActivity: null, updates: 0 }
        };
    }

    log(level, component, message, data = null) {
        const timestamp = new Date().toISOString();
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const prefix = `[${timestamp}] [${elapsed}s] [${level.toUpperCase()}] [${component}]`;

        console.log(`${prefix} ${message}`);
        if (data) {
            console.log(`${prefix} DATA:`, JSON.stringify(data, null, 2));
        }
    }

    async startMonitoring() {
        this.log('info', 'SENSORS', '🚀 Starting comprehensive pipeline monitoring...');

        // 1. Monitor Backend WebSocket
        this.monitorBackend();

        // 2. Monitor UI (if available)
        this.monitorUI();

        // 3. Monitor Provider (via extension logs - simulated)
        this.monitorProvider();

        // 4. Health checks
        this.startHealthChecks();

        // 5. Periodic status reports
        setInterval(() => this.statusReport(), 10000);
    }

    monitorBackend() {
        this.log('info', 'BACKEND', '🔌 Connecting to backend WebSocket (ws://localhost:8080)...');

        try {
            this.backendWs = new WebSocket('ws://localhost:8080');

            this.backendWs.on('open', () => {
                this.pipeline.backend.status = 'connected';
                this.pipeline.backend.lastActivity = Date.now();
                this.log('success', 'BACKEND', '✅ Backend WebSocket connected');
            });

            this.backendWs.on('message', (data) => {
                try {
                    this.backendEvents++;
                    this.pipeline.backend.events++;
                    this.pipeline.backend.lastActivity = Date.now();

                    const msg = JSON.parse(data.toString());

                    // Track different event types
                    if (msg.event === 'endpoint_captured') {
                        this.captureCount++;
                        this.pipeline.provider.captures++;
                        this.pipeline.provider.lastActivity = Date.now();
                        this.log('capture', 'PROVIDER→BACKEND', `📡 CAPTURE #${this.captureCount}`, {
                            url: msg.data?.url?.substring(0, 100),
                            provider: msg.data?.provider,
                            size: JSON.stringify(msg).length
                        });
                    } else if (msg.event === 'system_status') {
                        this.log('status', 'BACKEND', '📊 System Status Update', msg.data);
                    } else if (msg.event === 'arbitrage_opportunity') {
                        this.log('alert', 'BACKEND', '🎯 ARBITRAGE OPPORTUNITY DETECTED!', msg.data);
                    } else {
                        this.log('event', 'BACKEND', `📨 Event: ${msg.event}`, msg);
                    }
                } catch (e) {
                    this.log('error', 'BACKEND', '❌ Failed to parse backend message', e.message);
                    this.errors.push({ component: 'backend', error: e.message, data: data.toString().substring(0, 200) });
                }
            });

            this.backendWs.on('error', (err) => {
                this.pipeline.backend.status = 'error';
                this.log('error', 'BACKEND', '❌ Backend WebSocket error', err.message);
                this.errors.push({ component: 'backend', error: err.message });
            });

            this.backendWs.on('close', () => {
                this.pipeline.backend.status = 'disconnected';
                this.log('warning', 'BACKEND', '🔌 Backend WebSocket disconnected');
            });

        } catch (e) {
            this.log('error', 'BACKEND', '❌ Failed to create backend WebSocket', e.message);
        }
    }

    monitorUI() {
        // Note: UI monitoring would require browser automation or extension
        // For now, we'll simulate based on backend events
        this.log('info', 'UI', '👁️ UI monitoring initialized (events will be inferred from backend)');
        this.pipeline.ui.status = 'monitoring';
    }

    monitorProvider() {
        // Provider monitoring via simulated extension logs
        this.log('info', 'PROVIDER', '🔍 Provider monitoring initialized (extension logs)');
        this.pipeline.provider.status = 'monitoring';

        // In a real implementation, this would hook into extension console logs
        // For now, we'll rely on backend events to infer provider activity
    }

    startHealthChecks() {
        setInterval(() => {
            this.healthCheck();
        }, 30000); // Every 30 seconds
    }

    async healthCheck() {
        this.log('info', 'HEALTH', '🔍 Running health checks...');

        // Check backend connectivity
        if (this.backendWs && this.backendWs.readyState === WebSocket.OPEN) {
            this.pipeline.backend.status = 'healthy';
        } else {
            this.pipeline.backend.status = 'unhealthy';
            this.log('warning', 'HEALTH', '❌ Backend WebSocket not healthy');
        }

        // Check for recent activity
        const now = Date.now();
        const recentThreshold = 60000; // 1 minute

        if (this.pipeline.provider.lastActivity &&
            (now - this.pipeline.provider.lastActivity) > recentThreshold) {
            this.log('warning', 'HEALTH', '⚠️ No recent provider activity');
        }

        if (this.pipeline.backend.lastActivity &&
            (now - this.pipeline.backend.lastActivity) > recentThreshold) {
            this.log('warning', 'HEALTH', '⚠️ No recent backend activity');
        }
    }

    statusReport() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        this.log('report', 'STATUS', `📊 Status Report (${elapsed}s elapsed)`, {
            pipeline: this.pipeline,
            totals: {
                captures: this.captureCount,
                backendEvents: this.backendEvents,
                errors: this.errors.length
            }
        });

        if (this.errors.length > 0) {
            this.log('warning', 'STATUS', `⚠️ ${this.errors.length} errors detected`);
        }
    }

    async diagnose() {
        this.log('info', 'DIAGNOSIS', '🔬 Running pipeline diagnosis...');

        // Check if backend is running
        try {
            const net = require('net');
            const backendUp = await new Promise((resolve) => {
                const socket = net.createConnection(8080, 'localhost');
                socket.on('connect', () => {
                    socket.end();
                    resolve(true);
                });
                socket.on('error', () => resolve(false));
                setTimeout(() => {
                    socket.end();
                    resolve(false);
                }, 2000);
            });

            if (backendUp) {
                this.log('success', 'DIAGNOSIS', '✅ Backend port 8080 is accessible');
            } else {
                this.log('error', 'DIAGNOSIS', '❌ Backend port 8080 is not accessible');
            }
        } catch (e) {
            this.log('error', 'DIAGNOSIS', '❌ Backend connectivity check failed', e.message);
        }

        // Check extension files
        const extensionPath = path.join(__dirname, 'extension_desktop');
        if (fs.existsSync(extensionPath)) {
            this.log('success', 'DIAGNOSIS', '✅ Extension directory exists');
        } else {
            this.log('error', 'DIAGNOSIS', '❌ Extension directory not found');
        }

        // Check dashboard
        const dashboardPath = path.join(__dirname, 'dashboard', 'index.html');
        if (fs.existsSync(dashboardPath)) {
            this.log('success', 'DIAGNOSIS', '✅ Dashboard exists');
        } else {
            this.log('error', 'DIAGNOSIS', '❌ Dashboard not found');
        }
    }

    cleanup() {
        if (this.backendWs) {
            this.backendWs.close();
        }
        this.log('info', 'SENSORS', '🛑 Debug sensors stopped');
    }
}

// Main execution
if (require.main === module) {
    const sensors = new DebugSensors();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n');
        sensors.log('info', 'SENSORS', '🛑 Received shutdown signal...');
        sensors.cleanup();
        process.exit(0);
    });

    // Start monitoring
    sensors.startMonitoring();

    // Run initial diagnosis
    setTimeout(() => sensors.diagnose(), 2000);

    // Keep alive
    setInterval(() => {}, 1000);
}

module.exports = DebugSensors;