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
        const domainLower = domain.toLowerCase();
        const patternLower = pattern.toLowerCase();
        if (domainLower === patternLower) {
            return true;
        }
        // Handle subdomain matching (e.g., *.example.com matches sub.example.com)
        if (patternLower.startsWith('*.')) {
            const baseDomain = patternLower.substring(2);
            return domainLower.endsWith('.' + baseDomain) || domainLower === baseDomain;
        }
        return false;
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
