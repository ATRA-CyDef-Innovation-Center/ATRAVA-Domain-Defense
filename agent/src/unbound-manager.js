"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnboundManager = void 0;
const child_process_1 = require("child_process");
const fs = require("fs");
/**
 * Manages Unbound DNS resolver configuration and monitoring
 * Works in tandem with CoreDNS for policy enforcement
 */
class UnboundManager {
    constructor(unboundControlCmd = 'unbound-control', logFile = '/var/log/unbound/unbound.log') {
        this.unboundControlCmd = unboundControlCmd;
        this.logFile = logFile;
        this.policyCounters = {
            totalQueries: 0,
            allowedQueries: 0,
            blockedQueries: 0,
        };
        this.policyCounterStartedAt = new Date().toISOString();
        this.logCursor = {
            fileId: '',
            offset: 0,
            pending: '',
            initialized: false,
        };
    }
    /**
     * Get Unbound server status
     */
    async getStatus() {
        try {
            const statsOutput = (0, child_process_1.execSync)(`${this.unboundControlCmd} stats_noreset`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            return this.parseStats(statsOutput);
        }
        catch (error) {
            try {
                const statsOutput = (0, child_process_1.execSync)(`${this.unboundControlCmd} stats`, {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
                return this.parseStats(statsOutput);
            }
            catch (fallbackError) {
                console.error('[v0] Unbound status check failed:', fallbackError);
                return null;
            }
        }
    }
    /**
     * Get cache statistics from Unbound
     */
    async getCacheStats() {
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
        }
        catch (error) {
            console.error('[v0] Cache stats retrieval failed:', error);
            return { cacheHits: 0, cacheMisses: 0, hitRate: 0 };
        }
    }
    /**
     * Get query statistics from Unbound
     */
    async getQueryStats() {
        try {
            const stats = await this.getStatus();
            if (!stats) {
                return { totalQueries: 0, totalAnswers: 0, recursiveQueries: 0 };
            }
            return {
                totalQueries: parseInt(stats['total.num.queries'] || '0', 10),
                totalAnswers: parseInt(stats['total.num.answers'] || '0', 10),
                recursiveQueries: parseInt(stats['total.num.recursivereplies'] || '0', 10),
            };
        }
        catch (error) {
            console.error('[v0] Query stats retrieval failed:', error);
            return { totalQueries: 0, totalAnswers: 0, recursiveQueries: 0 };
        }
    }
    /**
     * Reload Unbound configuration
     */
    async reload() {
        try {
            (0, child_process_1.execSync)(`${this.unboundControlCmd} reload`, {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            console.log('[v0] Unbound reloaded successfully');
            return true;
        }
        catch (error) {
            console.error('[v0] Unbound reload failed:', error);
            return false;
        }
    }
    /**
     * Flush Unbound cache
     */
    async flushCache() {
        try {
            (0, child_process_1.execSync)(`${this.unboundControlCmd} flush_cache`, {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            console.log('[v0] Unbound cache flushed');
            return true;
        }
        catch (error) {
            console.error('[v0] Cache flush failed:', error);
            return false;
        }
    }
    /**
     * Dump Unbound cache (returns top N entries)
     */
    async dumpCache(limit = 100) {
        try {
            const cacheOutput = (0, child_process_1.execSync)(`${this.unboundControlCmd} dump_cache`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            return cacheOutput
                .split('\n')
                .filter((line) => line.trim())
                .slice(0, limit);
        }
        catch (error) {
            console.error('[v0] Cache dump failed:', error);
            return [];
        }
    }
    /**
     * Get tail of Unbound logs
     */
    async getTailLogs(lines = 50) {
        try {
            const logsOutput = (0, child_process_1.execSync)(`tail -n ${lines} ${this.logFile}`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            return logsOutput
                .split('\n')
                .filter((line) => line.trim())
                .reverse();
        }
        catch (error) {
            console.error('[v0] Log retrieval failed:', error);
            return [];
        }
    }
    /**
     * Count new Unbound query log lines once and return cumulative policy counters.
     */
    async getCumulativePolicyCounters(policyCache) {
        try {
            const delta = this.readNewPolicyQueryCounts(policyCache);
            this.policyCounters.totalQueries += delta.totalQueries;
            this.policyCounters.allowedQueries += delta.allowedQueries;
            this.policyCounters.blockedQueries += delta.blockedQueries;
            const blockRate = this.policyCounters.totalQueries > 0
                ? (this.policyCounters.blockedQueries / this.policyCounters.totalQueries) * 100
                : 0;
            return {
                totalQueries: this.policyCounters.totalQueries,
                allowedQueries: this.policyCounters.allowedQueries,
                blockedQueries: this.policyCounters.blockedQueries,
                newQueries: delta.totalQueries,
                newAllowedQueries: delta.allowedQueries,
                newBlockedQueries: delta.blockedQueries,
                blockRate: parseFloat(blockRate.toFixed(2)),
                counterStartedAt: this.policyCounterStartedAt,
                logOffset: this.logCursor.offset,
            };
        }
        catch (error) {
            console.error('[v0] Cumulative policy counter update failed:', error);
            const blockRate = this.policyCounters.totalQueries > 0
                ? (this.policyCounters.blockedQueries / this.policyCounters.totalQueries) * 100
                : 0;
            return {
                totalQueries: this.policyCounters.totalQueries,
                allowedQueries: this.policyCounters.allowedQueries,
                blockedQueries: this.policyCounters.blockedQueries,
                newQueries: 0,
                newAllowedQueries: 0,
                newBlockedQueries: 0,
                blockRate: parseFloat(blockRate.toFixed(2)),
                counterStartedAt: this.policyCounterStartedAt,
                logOffset: this.logCursor.offset,
            };
        }
    }
    /**
     * Backward-compatible wrapper for older callers.
     */
    async getPolicyQueryStats(policyCache) {
        const counters = await this.getCumulativePolicyCounters(policyCache);
        return {
            sampledQueries: counters.totalQueries,
            blockedQueries: counters.blockedQueries,
            blockRate: counters.blockRate,
        };
    }
    readNewPolicyQueryCounts(policyCache) {
        const empty = { totalQueries: 0, allowedQueries: 0, blockedQueries: 0 };
        let stat;
        try {
            stat = fs.statSync(this.logFile);
        }
        catch (error) {
            if (error && error.code !== 'ENOENT') {
                console.error('[v0] Unable to stat Unbound log file:', error);
            }
            return empty;
        }
        const fileId = this.fileId(stat);
        if (!this.logCursor.initialized ||
            this.logCursor.fileId !== fileId ||
            stat.size < this.logCursor.offset) {
            if (this.logCursor.initialized) {
                console.log('[v0] Unbound log rotated or truncated; continuing cumulative counters from new log file');
            }
            this.logCursor = {
                fileId,
                offset: 0,
                pending: '',
                initialized: true,
            };
        }
        if (stat.size <= this.logCursor.offset) {
            return empty;
        }
        const counts = { ...empty };
        const fd = fs.openSync(this.logFile, 'r');
        try {
            const buffer = Buffer.alloc(64 * 1024);
            let position = this.logCursor.offset;
            let pending = this.logCursor.pending || '';
            while (position < stat.size) {
                const remaining = stat.size - position;
                const bytesRead = fs.readSync(fd, buffer, 0, Math.min(buffer.length, remaining), position);
                if (bytesRead <= 0)
                    break;
                position += bytesRead;
                const chunk = pending + buffer.toString('utf8', 0, bytesRead);
                const lines = chunk.split('\n');
                pending = lines.pop() || '';
                lines.forEach((line) => {
                    this.countPolicyQueryLine(line.replace(/\r$/, ''), policyCache, counts);
                });
            }
            this.logCursor.offset = position;
            this.logCursor.pending = pending;
        }
        finally {
            fs.closeSync(fd);
        }
        return counts;
    }
    countPolicyQueryLine(line, policyCache, counts) {
        const domain = this.queryDomainFromLogLine(line);
        if (!domain)
            return;
        counts.totalQueries += 1;
        const isBlocked = !policyCache.isDomainWhitelisted(domain) && policyCache.isDomainBlacklisted(domain);
        if (isBlocked) {
            counts.blockedQueries += 1;
        }
        else {
            counts.allowedQueries += 1;
        }
    }
    queryDomainFromLogLine(line) {
        const match = String(line || '').match(/\bquery:\s+\S+\s+(\S+)\s+\S+\s+IN\b/);
        if (!match)
            return '';
        return match[1].replace(/\.$/, '').toLowerCase();
    }
    fileId(stat) {
        return `${stat.dev || 0}:${stat.ino || 0}:${stat.birthtimeMs || 0}`;
    }
    /**
     * Check if Unbound is running
     */
    async isRunning() {
        try {
            (0, child_process_1.execSync)(`${this.unboundControlCmd} status`, {
                stdio: ['pipe', 'ignore', 'ignore'],
            });
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get memory usage statistics
     */
    async getMemoryStats() {
        try {
            const stats = await this.getStatus();
            if (!stats) {
                return {
                    totalMemory: '0 MB',
                    messageCache: '0 MB',
                    rrsetCache: '0 MB',
                };
            }
            const formatMemory = (bytes) => {
                const num = parseInt(bytes, 10);
                if (num > 1024 * 1024) {
                    return (num / (1024 * 1024)).toFixed(2) + ' MB';
                }
                else if (num > 1024) {
                    return (num / 1024).toFixed(2) + ' KB';
                }
                return num + ' B';
            };
            return {
                totalMemory: formatMemory(stats['total.memory.unwrap'] || '0'),
                messageCache: formatMemory(stats['msg.cache.count'] || '0'),
                rrsetCache: formatMemory(stats['rrset.cache.count'] || '0'),
            };
        }
        catch (error) {
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
    parseStats(stats) {
        const result = {};
        stats.split('\n').forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed)
                return;
            const equalsIndex = trimmed.indexOf('=');
            if (equalsIndex === -1)
                return;
            const key = trimmed.substring(0, equalsIndex).trim();
            const value = trimmed.substring(equalsIndex + 1).trim();
            result[key] = value;
        });
        return result;
    }
    /**
     * Get comprehensive Unbound health report
     */
    async getHealthReport() {
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
exports.UnboundManager = UnboundManager;
