"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitor = void 0;
const os = __importStar(require("os"));
class HealthMonitor {
    constructor(db, nodeId) {
        this.startTime = new Date();
        this.queryCount = 0;
        this.blockCount = 0;
        this.db = db;
        this.nodeId = nodeId;
    }
    async checkHealth() {
        try {
            console.log('[v0] Running health check...');
            // Check Firestore connectivity
            const testDoc = await this.db.collection('_health').doc('check').get();
            // Calculate uptime
            const uptime = this.calculateUptime();
            // Get system metrics
            const cpuUsage = os.loadavg()[0];
            const memoryUsage = (1 - os.freemem() / os.totalmem()) * 100;
            // Determine status based on metrics
            let status = 'online';
            if (memoryUsage > 90 || cpuUsage > 4) {
                status = 'warning';
            }
            console.log('[v0] Health check results:');
            console.log(`  - Uptime: ${uptime}%`);
            console.log(`  - CPU Load: ${cpuUsage.toFixed(2)}`);
            console.log(`  - Memory: ${memoryUsage.toFixed(1)}%`);
            return;
        }
        catch (error) {
            console.error('[v0] Health check failed:', error);
            throw error;
        }
    }
    async reportMetrics() {
        try {
            console.log('[v0] Reporting metrics...');
            const uptime = this.calculateUptime();
            const queriesPerDay = Math.floor(this.queryCount / ((Date.now() - this.startTime.getTime()) / (1000 * 60 * 60 * 24)));
            const blockRate = this.queryCount > 0 ? (this.blockCount / this.queryCount) * 100 : 0;
            const metrics = {
                timestamp: new Date().toISOString(),
                uptime,
                queriesPerDay: Math.max(queriesPerDay, 0),
                blockRate: blockRate.toFixed(2),
                memoryUsage: (1 - os.freemem() / os.totalmem()) * 100,
                cpuLoad: os.loadavg()[0],
            };
            // Update node metrics in Firestore
            await this.db.collection('nodes').doc(this.nodeId).update({
                uptime: metrics.uptime,
                queriesPerDay: metrics.queriesPerDay,
                blockRate: parseFloat(metrics.blockRate),
                lastHealthCheck: metrics.timestamp,
            });
            // Log metrics
            await this.db.collection('nodeMetrics').add({
                nodeId: this.nodeId,
                ...metrics,
            });
            console.log('[v0] Metrics reported');
        }
        catch (error) {
            console.error('[v0] Error reporting metrics:', error);
        }
    }
    calculateUptime() {
        const runningTime = Date.now() - this.startTime.getTime();
        // Simulate uptime percentage (in production, would calculate actual DNS service uptime)
        return Math.min(100, 99 + Math.random());
    }
    // Methods to track DNS activity (called by CoreDNS plugin or log parser)
    recordQuery(blocked) {
        this.queryCount++;
        if (blocked) {
            this.blockCount++;
        }
    }
    getMetrics() {
        return {
            uptime: this.calculateUptime(),
            totalQueries: this.queryCount,
            totalBlocked: this.blockCount,
            blockRate: this.queryCount > 0 ? (this.blockCount / this.queryCount) * 100 : 0,
        };
    }
}
exports.HealthMonitor = HealthMonitor;
