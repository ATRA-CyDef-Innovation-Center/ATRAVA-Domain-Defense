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
class PolicySyncManager {
    constructor(db, nodeId, coreDnsConfigPath, policyCache) {
        this.lastSyncVersion = '';
        this.db = db;
        this.nodeId = nodeId;
        this.coreDnsConfigPath = coreDnsConfigPath;
        this.policyCache = policyCache;
    }
    async syncPolicies() {
        try {
            console.log('[v0] Starting policy sync...');
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
            if (currentVersion === this.lastSyncVersion) {
                console.log('[v0] Policies already up-to-date');
                return;
            }
            console.log('[v0] New policy version detected:', currentVersion);
            // Fetch blacklist domains
            const blacklistSnapshot = await this.db
                .collection('domains')
                .doc('blacklist')
                .collection('entries')
                .get();
            const blacklistedDomains = blacklistSnapshot.docs.map((doc) => ({
                domain: doc.data().domain,
                threatLevel: doc.data().threatLevel,
            }));
            // Fetch whitelist domains
            const whitelistSnapshot = await this.db
                .collection('domains')
                .doc('whitelist')
                .collection('entries')
                .get();
            const whitelistedDomains = whitelistSnapshot.docs.map((doc) => doc.data().domain);
            // Update cache
            this.policyCache.updatePolicies({
                blacklist: blacklistedDomains,
                whitelist: whitelistedDomains,
                version: currentVersion,
            });
            // Update CoreDNS configuration
            await this.updateCoreDNSConfig(blacklistedDomains, whitelistedDomains);
            // Update last sync version
            this.lastSyncVersion = currentVersion;
            // Update node sync status
            await this.db.collection('nodes').doc(this.nodeId).update({
                syncStatus: 'success',
                syncVersion: currentVersion,
                lastSync: new Date().toISOString(),
            });
            console.log('[v0] Policy sync completed successfully');
            console.log(`[v0] Blacklisted domains: ${blacklistedDomains.length}`);
            console.log(`[v0] Whitelisted domains: ${whitelistedDomains.length}`);
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
        }
    }
    async updateCoreDNSConfig(blacklistedDomains, whitelistedDomains) {
        try {
            console.log('[v0] Updating CoreDNS configuration...');
            // Generate a hosts file for blocked domains. CoreDNS falls through for everything else.
            let zoneContent = '# GCOT policy hosts file\n\n';
            // Add blocked domains
            zoneContent += '# === Blacklisted Domains ===\n';
            blacklistedDomains.forEach((entry) => {
                zoneContent += `127.0.0.1 ${entry.domain} # threat: ${entry.threatLevel}\n`;
            });
            // Add whitelist comment
            zoneContent += '\n# === Whitelisted Domains (Always Allowed) ===\n';
            whitelistedDomains.forEach((domain) => {
                zoneContent += `# ${domain}\n`;
            });
            // Write zone file (in production, this would write to actual zone files)
            const zoneFilePath = path.join(path.dirname(this.coreDnsConfigPath), 'policies.zone');
            fs.writeFileSync(zoneFilePath, zoneContent);
            console.log('[v0] CoreDNS configuration updated');
            console.log(`[v0] Zone file written to: ${zoneFilePath}`);
            // In production, reload CoreDNS with: systemctl reload coredns or send SIGHUP
            // For now, just log that it would be reloaded
            console.log('[v0] (Would reload CoreDNS in production)');
        }
        catch (error) {
            console.error('[v0] Error updating CoreDNS config:', error);
            throw error;
        }
    }
}
exports.PolicySyncManager = PolicySyncManager;
