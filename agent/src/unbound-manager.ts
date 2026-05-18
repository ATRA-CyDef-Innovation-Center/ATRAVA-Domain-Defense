import { execSync } from 'child_process';
import { readFileSync } from 'fs';

/**
 * Manages Unbound DNS resolver configuration and monitoring
 * Works in tandem with CoreDNS for policy enforcement
 */
export class UnboundManager {
  private unboundControlCmd: string;
  private logFile: string;

  constructor(
    unboundControlCmd: string = 'unbound-control',
    logFile: string = '/var/log/unbound/unbound.log'
  ) {
    this.unboundControlCmd = unboundControlCmd;
    this.logFile = logFile;
  }

  /**
   * Get Unbound server status
   */
  async getStatus(): Promise<Record<string, string> | null> {
    try {
      const statsOutput = execSync(`${this.unboundControlCmd} stats`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return this.parseStats(statsOutput);
    } catch (error) {
      console.error('[v0] Unbound status check failed:', error);
      return null;
    }
  }

  /**
   * Get cache statistics from Unbound
   */
  async getCacheStats(): Promise<{
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
  }> {
    try {
      const stats = await this.getStatus();
      if (!stats) {
        return { cacheHits: 0, cacheMisses: 0, hitRate: 0 };
      }

      const hits = parseInt(stats['total.cachehits'] || '0', 10);
      const misses = parseInt(stats['total.cachemiss'] || '0', 10);
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;

      return {
        cacheHits: hits,
        cacheMisses: misses,
        hitRate: parseFloat(hitRate.toFixed(2)),
      };
    } catch (error) {
      console.error('[v0] Cache stats retrieval failed:', error);
      return { cacheHits: 0, cacheMisses: 0, hitRate: 0 };
    }
  }

  /**
   * Get query statistics from Unbound
   */
  async getQueryStats(): Promise<{
    totalQueries: number;
    totalAnswers: number;
    recursiveQueries: number;
  }> {
    try {
      const stats = await this.getStatus();
      if (!stats) {
        return { totalQueries: 0, totalAnswers: 0, recursiveQueries: 0 };
      }

      return {
        totalQueries: parseInt(stats['total.num.queries'] || '0', 10),
        totalAnswers: parseInt(stats['total.num.answers'] || '0', 10),
        recursiveQueries: parseInt(
          stats['total.num.recursivereplies'] || '0',
          10
        ),
      };
    } catch (error) {
      console.error('[v0] Query stats retrieval failed:', error);
      return { totalQueries: 0, totalAnswers: 0, recursiveQueries: 0 };
    }
  }

  /**
   * Reload Unbound configuration
   */
  async reload(): Promise<boolean> {
    try {
      execSync(`${this.unboundControlCmd} reload`, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      console.log('[v0] Unbound reloaded successfully');
      return true;
    } catch (error) {
      console.error('[v0] Unbound reload failed:', error);
      return false;
    }
  }

  /**
   * Flush Unbound cache
   */
  async flushCache(): Promise<boolean> {
    try {
      execSync(`${this.unboundControlCmd} flush_cache`, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      console.log('[v0] Unbound cache flushed');
      return true;
    } catch (error) {
      console.error('[v0] Cache flush failed:', error);
      return false;
    }
  }

  /**
   * Dump Unbound cache (returns top N entries)
   */
  async dumpCache(limit: number = 100): Promise<string[]> {
    try {
      const cacheOutput = execSync(`${this.unboundControlCmd} dump_cache`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return cacheOutput
        .split('\n')
        .filter((line) => line.trim())
        .slice(0, limit);
    } catch (error) {
      console.error('[v0] Cache dump failed:', error);
      return [];
    }
  }

  /**
   * Get tail of Unbound logs
   */
  async getTailLogs(lines: number = 50): Promise<string[]> {
    try {
      const logsOutput = execSync(`tail -n ${lines} ${this.logFile}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return logsOutput
        .split('\n')
        .filter((line) => line.trim())
        .reverse();
    } catch (error) {
      console.error('[v0] Log retrieval failed:', error);
      return [];
    }
  }

  /**
   * Check if Unbound is running
   */
  async isRunning(): Promise<boolean> {
    try {
      execSync(`${this.unboundControlCmd} status`, {
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get memory usage statistics
   */
  async getMemoryStats(): Promise<{
    totalMemory: string;
    messageCache: string;
    rrsetCache: string;
  }> {
    try {
      const stats = await this.getStatus();
      if (!stats) {
        return {
          totalMemory: '0 MB',
          messageCache: '0 MB',
          rrsetCache: '0 MB',
        };
      }

      const formatMemory = (bytes: string): string => {
        const num = parseInt(bytes, 10);
        if (num > 1024 * 1024) {
          return (num / (1024 * 1024)).toFixed(2) + ' MB';
        } else if (num > 1024) {
          return (num / 1024).toFixed(2) + ' KB';
        }
        return num + ' B';
      };

      return {
        totalMemory: formatMemory(stats['total.memory.unwrap'] || '0'),
        messageCache: formatMemory(stats['msg.cache.count'] || '0'),
        rrsetCache: formatMemory(stats['rrset.cache.count'] || '0'),
      };
    } catch (error) {
      console.error('[v0] Memory stats retrieval failed:', error);
      return {
        totalMemory: '0 MB',
        messageCache: '0 MB',
        rrsetCache: '0 MB',
      };
    }
  }

  /**
   * Parse unbound-control stats output into key-value pairs
   */
  private parseStats(stats: string): Record<string, string> {
    const result: Record<string, string> = {};

    stats.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex === -1) return;

      const key = trimmed.substring(0, equalsIndex).trim();
      const value = trimmed.substring(equalsIndex + 1).trim();

      result[key] = value;
    });

    return result;
  }

  /**
   * Get comprehensive Unbound health report
   */
  async getHealthReport(): Promise<{
    isRunning: boolean;
    uptime: string;
    cacheStats: {
      cacheHits: number;
      cacheMisses: number;
      hitRate: number;
    };
    queryStats: {
      totalQueries: number;
      totalAnswers: number;
      recursiveQueries: number;
    };
    memoryStats: {
      totalMemory: string;
      messageCache: string;
      rrsetCache: string;
    };
  }> {
    const isRunning = await this.isRunning();

    return {
      isRunning,
      uptime: isRunning ? 'Running' : 'Not Running',
      cacheStats: await this.getCacheStats(),
      queryStats: await this.getQueryStats(),
      memoryStats: await this.getMemoryStats(),
    };
  }
}
