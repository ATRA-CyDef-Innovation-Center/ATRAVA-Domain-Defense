"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyCache = void 0;
class PolicyCache {
    constructor() {
        this.policies = {
            blacklist: [],
            whitelist: [],
            version: '',
        };
    }
    updatePolicies(policies) {
        this.policies = policies;
        console.log('[v0] Policy cache updated');
    }
    getPolicies() {
        return this.policies;
    }
    isDomainBlacklisted(domain) {
        return this.policies.blacklist.some((entry) => this.matchDomain(domain, entry.domain));
    }
    isDomainWhitelisted(domain) {
        return this.policies.whitelist.some((whitelistedDomain) => this.matchDomain(domain, whitelistedDomain));
    }
    matchDomain(domain, pattern) {
        const domainLower = this.cleanDomain(domain);
        const patternLower = this.cleanDomain(pattern);
        if (!domainLower || !patternLower) {
            return false;
        }
        if (domainLower === patternLower) {
            return true;
        }
        // A parent-domain policy should cover its subdomains as well.
        if (domainLower.endsWith('.' + patternLower)) {
            return true;
        }
        if (patternLower.startsWith('*.')) {
            const baseDomain = patternLower.substring(2);
            return domainLower.endsWith('.' + baseDomain) || domainLower === baseDomain;
        }
        return false;
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
    getStats() {
        return {
            blacklistedDomains: this.policies.blacklist.length,
            whitelistedDomains: this.policies.whitelist.length,
            version: this.policies.version,
        };
    }
}
exports.PolicyCache = PolicyCache;
