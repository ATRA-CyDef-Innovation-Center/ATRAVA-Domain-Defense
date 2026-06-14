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
exports.PolicySyncManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class PolicySyncManager {
    constructor(db, nodeId, coreDnsConfigPath, policyCache) {
        this.lastSyncVersion = '';
        this.db = db;
        this.nodeId = nodeId;
        this.coreDnsConfigPath = coreDnsConfigPath;
        this.policyCache = policyCache;
        this.blockPageIp = process.env.BLOCK_PAGE_IP || process.env.NODE_IP || '127.0.0.1';
        this.blockPageIpv6 = process.env.BLOCK_PAGE_IPV6 || '';
    }
    async syncPolicies(options = {}) {
        try {
            console.log('[v0] Starting policy sync...');
            const force = Boolean(options.force);
            const changedDomain = this.cleanDomain(options.domain);
            // Fetch current policy manifest
            const manifestRef = this.db.collection('_system').doc('policyManifest');
            const manifestDoc = await manifestRef.get();
            let currentVersion;
            if (!manifestDoc.exists) {
                console.log('[v0] No policy manifest found, creating one from current domain entries');
                currentVersion = new Date().toISOString();
                await manifestRef.set({
                    timestamp: currentVersion,
                    createdAt: currentVersion,
                    createdBy: this.nodeId,
                }, { merge: true });
            }
            else {
                const manifest = manifestDoc.data();
                currentVersion = (manifest === null || manifest === void 0 ? void 0 : manifest.timestamp) || new Date().toISOString();
            }
            // Check if we need to sync
            if (!force && currentVersion === this.lastSyncVersion) {
                console.log('[v0] Policies already up-to-date');
                return true;
            }
            if (force) {
                console.log('[v0] Force policy sync requested');
            }
            else {
                console.log('[v0] New policy version detected:', currentVersion);
            }
            // Fetch blacklist domains
            const blacklistSnapshot = await this.db
                .collection('domains')
                .doc('blacklist')
                .collection('entries')
                .get();
            const blacklistedDomains = this.normalizeBlacklistEntries(blacklistSnapshot.docs);
            // Fetch whitelist domains
            const whitelistSnapshot = await this.db
                .collection('domains')
                .doc('whitelist')
                .collection('entries')
                .get();
            const whitelistedDomains = this.normalizeWhitelistEntries(whitelistSnapshot.docs);
            // Update cache
            this.policyCache.updatePolicies({
                blacklist: blacklistedDomains,
                whitelist: whitelistedDomains,
                version: currentVersion,
            });
            // Update CoreDNS configuration
            await this.updateCoreDNSConfig(blacklistedDomains, whitelistedDomains);
            await this.flushPolicyCaches({
                changedDomain,
                blacklistedDomains,
                whitelistedDomains,
            });
            // Update last sync version
            this.lastSyncVersion = currentVersion;
            // Update node sync status
            await this.db.collection('nodes').doc(this.nodeId).update({
                syncStatus: 'success',
                syncVersion: currentVersion,
                lastSync: new Date().toISOString(),
                blacklistedDomains: blacklistedDomains.length,
                whitelistedDomains: whitelistedDomains.length,
                enforcementMode: 'parent-domain-and-subdomains',
            });
            console.log('[v0] Policy sync completed successfully');
            console.log(`[v0] Blacklisted domains: ${blacklistedDomains.length}`);
            console.log(`[v0] Whitelisted domains: ${whitelistedDomains.length}`);
            return true;
        }
        catch (error) {
            console.error('[v0] Error during policy sync:', error);
            // Update sync error status
            try {
                await this.db.collection('nodes').doc(this.nodeId).update({
                    syncStatus: 'error',
                    lastSyncError: String(error),
                    lastSync: new Date().toISOString(),
                });
            }
            catch (updateError) {
                console.error('[v0] Failed to update node sync status:', updateError);
            }
            return false;
        }
    }
    async updateCoreDNSConfig(blacklistedDomains, whitelistedDomains) {
        try {
            console.log('[v0] Updating CoreDNS configuration...');
            // Keep a hosts file for exact-name compatibility and generate CoreDNS
            // template rules so parent-domain policies also cover subdomains.
            let zoneContent = '# GCOT policy hosts file\n\n';
            let templateContent = '# GCOT generated CoreDNS policy templates\n';
            templateContent += '# Parent-domain blacklist entries apply to matching subdomains.\n\n';
            // Add blocked domains
            zoneContent += '# === Blacklisted Domains ===\n';
            blacklistedDomains.forEach((entry) => {
                zoneContent += `${this.blockPageIp} ${entry.domain} # threat: ${entry.threatLevel}\n`;
                templateContent += this.templateForBlockedDomain(entry.domain);
            });
            // Add whitelist comment
            zoneContent += '\n# === Whitelisted Domains (Always Allowed) ===\n';
            whitelistedDomains.forEach((domain) => {
                zoneContent += `# ${domain}\n`;
            });
            // Write zone file (in production, this would write to actual zone files)
            const policyDir = path.dirname(this.coreDnsConfigPath);
            const zoneFilePath = path.join(policyDir, 'policies.zone');
            const templateFilePath = path.join(policyDir, 'policies.coredns');
            fs.writeFileSync(zoneFilePath, zoneContent);
            fs.writeFileSync(templateFilePath, templateContent);
            console.log('[v0] CoreDNS configuration updated');
            console.log(`[v0] Zone file written to: ${zoneFilePath}`);
            console.log(`[v0] Policy template file written to: ${templateFilePath}`);
        }
        catch (error) {
            console.error('[v0] Error updating CoreDNS config:', error);
            throw error;
        }
    }
    async flushPolicyCaches({ changedDomain, blacklistedDomains, whitelistedDomains }) {
        const domainsToFlush = new Set();
        if (changedDomain) {
            domainsToFlush.add(changedDomain);
        }
        else {
            [...blacklistedDomains.map((entry) => entry.domain), ...whitelistedDomains].forEach((domain) => {
                const clean = this.cleanDomain(domain);
                if (clean)
                    domainsToFlush.add(clean);
            });
        }
        try {
            for (const domain of domainsToFlush) {
                this.runUnboundControl(`flush ${this.shellQuote(domain)}`);
                this.runUnboundControl(`flush_zone ${this.shellQuote(domain)}`);
            }
            this.runUnboundControl('flush_negative');
            console.log(`[v0] Unbound cache flushed for ${domainsToFlush.size} policy domains`);
        }
        catch (flushError) {
            console.error('[v0] Failed to flush Unbound cache after policy update:', flushError);
        }
    }
    normalizeBlacklistEntries(docs) {
        const entries = new Map();
        docs.forEach((doc) => {
            const data = doc.data() || {};
            const domain = this.cleanDomain(data.domain);
            if (!domain)
                return;
            entries.set(domain, {
                domain,
                threatLevel: data.threatLevel || 'medium',
            });
        });
        return Array.from(entries.values()).sort((a, b) => a.domain.localeCompare(b.domain));
    }
    normalizeWhitelistEntries(docs) {
        const entries = new Set();
        docs.forEach((doc) => {
            const domain = this.cleanDomain((doc.data() || {}).domain);
            if (domain)
                entries.add(domain);
        });
        return Array.from(entries).sort((a, b) => a.localeCompare(b));
    }
    templateForBlockedDomain(domain) {
        const baseDomain = domain.replace(/^\*\./, '');
        const escapedDomain = this.escapeRegex(baseDomain);
        const match = `(^|.*\\.)${escapedDomain}\\.$`;
        let content = `template IN A ${baseDomain} {\n`;
        content += `    match ${match}\n`;
        content += `    answer "{{ .Name }} 30 IN A ${this.blockPageIp}"\n`;
        content += '}\n';
        content += `template IN AAAA ${baseDomain} {\n`;
        content += `    match ${match}\n`;
        if (this.blockPageIpv6) {
            content += `    answer "{{ .Name }} 30 IN AAAA ${this.blockPageIpv6}"\n`;
        }
        else {
            content += '    rcode NOERROR\n';
        }
        content += '}\n\n';
        return content;
    }
    escapeRegex(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    runUnboundControl(args) {
        (0, child_process_1.execSync)(`unbound-control ${args}`, {
            stdio: ['ignore', 'ignore', 'pipe'],
        });
    }
    cleanDomain(domain) {
        let clean = String(domain || '').trim().toLowerCase();
        if (!clean)
            return '';
        if (clean.includes('://') || /[/?#]/.test(clean)) {
            try {
                clean = new URL(clean.includes('://') ? clean : `http://${clean}`).hostname;
            }
            catch {
                clean = clean.split(/[/?#]/)[0];
            }
        }
        clean = clean.split(':')[0].replace(/\.$/, '');
        if (!/^(\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(clean))
            return '';
        return clean.replace(/^\.+|\.+$/g, '');
    }
    shellQuote(value) {
        return `'${String(value).replace(/'/g, "'\\''")}'`;
    }
}
exports.PolicySyncManager = PolicySyncManager;
