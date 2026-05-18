import * as os from 'os';

export class HealthMonitor {
  private db: FirebaseFirestore.Firestore;
  private nodeId: string;
  private startTime: Date = new Date();
  private queryCount: number = 0;
  private blockCount: number = 0;

  constructor(db: FirebaseFirestore.Firestore, nodeId: string) {
    this.db = db;
    this.nodeId = nodeId;
  }

  async checkHealth(): Promise<void> {
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
    } catch (error) {
      console.error('[v0] Health check failed:', error);
      throw error;
    }
  }

  async reportMetrics(): Promise<void> {
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
        blockRate: parseFloat(metrics.blockRate as string),
        lastHealthCheck: metrics.timestamp,
      });

      // Log metrics
      await this.db.collection('nodeMetrics').add({
        nodeId: this.nodeId,
        ...metrics,
      });

      console.log('[v0] Metrics reported');
    } catch (error) {
      console.error('[v0] Error reporting metrics:', error);
    }
  }

  private calculateUptime(): number {
    const runningTime = Date.now() - this.startTime.getTime();
    // Simulate uptime percentage (in production, would calculate actual DNS service uptime)
    return Math.min(100, 99 + Math.random());
  }

  // Methods to track DNS activity (called by CoreDNS plugin or log parser)
  recordQuery(blocked: boolean): void {
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
