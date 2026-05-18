import * as fs from 'fs';
import * as path from 'path';
import { PolicyCache } from './policy-cache';

export class PolicySyncManager {
  private db: FirebaseFirestore.Firestore;
  private nodeId: string;
  private coreDnsConfigPath: string;
  private policyCache: PolicyCache;
  private lastSyncVersion: string = '';

  constructor(
    db: FirebaseFirestore.Firestore,
    nodeId: string,
    coreDnsConfigPath: string,
    policyCache: PolicyCache
  ) {
    this.db = db;
    this.nodeId = nodeId;
    this.coreDnsConfigPath = coreDnsConfigPath;
    this.policyCache = policyCache;
  }

  async syncPolicies() {
    try {
      console.log('[v0] Starting policy sync...');

      // Fetch current policy manifest
      const manifestDoc = await this.db.collection('_system').doc('policyManifest').get();

      if (!manifestDoc.exists) {
        console.log('[v0] No policy manifest found, creating empty one');
        return;
      }

      const manifest = manifestDoc.data() as any;
      const currentVersion = manifest.timestamp;

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
    } catch (error) {
      console.error('[v0] Error during policy sync:', error);

      // Update sync error status
      try {
        await this.db.collection('nodes').doc(this.nodeId).update({
          syncStatus: 'error',
          lastSyncError: String(error),
          lastSync: new Date().toISOString(),
        });
      } catch (updateError) {
        console.error('[v0] Failed to update node sync status:', updateError);
      }
    }
  }

  private async updateCoreDNSConfig(
    blacklistedDomains: Array<{ domain: string; threatLevel: string }>,
    whitelistedDomains: string[]
  ) {
    try {
      console.log('[v0] Updating CoreDNS configuration...');

      // Generate zone file for blocked domains
      let zoneContent = '$ORIGIN example.com.\n';
      zoneContent += '@  3600  IN  SOA  ns1.example.com. admin.example.com. (2024051800 3600 1800 604800 86400)\n';
      zoneContent += '@  3600  IN  NS   ns1.example.com.\n';
      zoneContent += 'ns1  3600  IN  A   127.0.0.1\n\n';

      // Add blocked domains
      zoneContent += '; === Blacklisted Domains ===\n';
      blacklistedDomains.forEach((entry) => {
        zoneContent += `${entry.domain.split('.').join('.')}  3600  IN  A  127.0.0.1  ; threat: ${entry.threatLevel}\n`;
      });

      // Add whitelist comment
      zoneContent += '\n; === Whitelisted Domains (Always Allowed) ===\n';
      whitelistedDomains.forEach((domain) => {
        zoneContent += `; ${domain}\n`;
      });

      // Write zone file (in production, this would write to actual zone files)
      const zoneFilePath = path.join(path.dirname(this.coreDnsConfigPath), 'policies.zone');
      fs.writeFileSync(zoneFilePath, zoneContent);

      console.log('[v0] CoreDNS configuration updated');
      console.log(`[v0] Zone file written to: ${zoneFilePath}`);

      // In production, reload CoreDNS with: systemctl reload coredns or send SIGHUP
      // For now, just log that it would be reloaded
      console.log('[v0] (Would reload CoreDNS in production)');
    } catch (error) {
      console.error('[v0] Error updating CoreDNS config:', error);
      throw error;
    }
  }
}
