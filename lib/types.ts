export type UserRole = 'admin' | 'analyst' | 'viewer' | 'system_agent';

// User/Admin types
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  status?: 'active' | 'pending' | 'disabled';
  source?: 'invite' | 'manual';
  emailVerifiedAt?: string | Date | null;
  createdAt: Date;
  lastLoginAt?: Date;
}

// DNS Node types
export interface DnsNode {
  id: string;
  name: string;
  description?: string;
  ipAddress: string;
  port: number;
  status: 'online' | 'offline' | 'degraded';
  lastHeartbeat: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// Policy types
export interface DnsPolicy {
  id: string;
  name: string;
  description?: string;
  type: 'allow' | 'block' | 'redirect';
  domains: string[];
  redirectTarget?: string; // For redirect policies
  priority: number;
  enabled: boolean;
  appliedToNodes: string[]; // Array of node IDs
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID
}

// Whitelist entry types
export interface WhitelistedDomain {
  id: string;
  domain: string;
  reason: string;
  addedAt: Date;
  addedBy: string; // User ID
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// Blacklist entry types
export interface BlacklistedDomain {
  id: string;
  domain: string;
  threatLevel: 'critical' | 'high' | 'medium' | 'low';
  threatSources: string[]; // Tags: 'malware', 'phishing', 'botnet', 'c2', etc.
  reason: string;
  addedAt: Date;
  addedBy: string; // User ID
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// DNS Query Log types
export interface DnsQueryLog {
  id: string;
  nodeId: string;
  domain: string;
  queryType: string; // 'A', 'AAAA', 'MX', 'TXT', etc.
  result: 'allowed' | 'blocked' | 'redirected';
  source?: string; // Client IP
  timestamp: Date;
  responseTime?: number; // milliseconds
  decision?: {
    policyId?: string;
    reason: string;
  };
}

// Audit Log types
export interface AuditLog {
  id: string;
  userId: string;
  action: string; // 'create_policy', 'delete_domain', 'update_node', etc.
  resourceType: 'policy' | 'domain' | 'node' | 'settings';
  resourceId: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  timestamp: Date;
  ipAddress?: string;
}

// Settings types
export interface SystemSettings {
  id: string; // Usually 'default'
  organizationName: string;
  logRetentionDays: number;
  enableAuditLogging: boolean;
  defaultQueryTimeout: number; // milliseconds
  updatedAt: Date;
  updatedBy: string;
}
