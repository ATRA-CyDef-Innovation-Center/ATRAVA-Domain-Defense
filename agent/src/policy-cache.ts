export interface PolicySet {
  blacklist: Array<{ domain: string; threatLevel: string }>;
  whitelist: string[];
  version: string;
}

export class PolicyCache {
  private policies: PolicySet = {
    blacklist: [],
    whitelist: [],
    version: '',
  };

  updatePolicies(policies: PolicySet): void {
    this.policies = policies;
    console.log('[v0] Policy cache updated');
  }

  getPolicies(): PolicySet {
    return this.policies;
  }

  isDomainBlacklisted(domain: string): boolean {
    return this.policies.blacklist.some((entry) =>
      this.matchDomain(domain, entry.domain)
    );
  }

  isDomainWhitelisted(domain: string): boolean {
    return this.policies.whitelist.some((whitelistedDomain) =>
      this.matchDomain(domain, whitelistedDomain)
    );
  }

  private matchDomain(domain: string, pattern: string): boolean {
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
