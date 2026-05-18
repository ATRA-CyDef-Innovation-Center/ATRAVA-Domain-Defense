import type { UserRole } from '@/lib/types';

export type Permission =
  | 'dashboard.view'
  | 'domains.submit'
  | 'domains.manage'
  | 'nodes.view'
  | 'nodes.manage'
  | 'logs.view'
  | 'settings.manage'
  | 'users.manage'
  | 'agent.sync'
  | 'agent.heartbeat'
  | 'policies.retrieve';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  analyst: 'Analyst',
  viewer: 'Viewer',
  system_agent: 'System Agent',
};

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'dashboard.view',
    'domains.submit',
    'domains.manage',
    'nodes.view',
    'nodes.manage',
    'logs.view',
    'settings.manage',
    'users.manage',
    'agent.sync',
    'agent.heartbeat',
    'policies.retrieve',
  ],
  analyst: ['dashboard.view', 'domains.submit', 'nodes.view', 'logs.view'],
  viewer: ['dashboard.view', 'nodes.view', 'logs.view'],
  system_agent: ['agent.sync', 'agent.heartbeat', 'policies.retrieve'],
};

export function hasPermission(role: UserRole | undefined, permission: Permission) {
  if (!role) {
    return false;
  }

  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessRoute(role: UserRole | undefined, pathname: string) {
  if (!role) {
    return false;
  }

  if (pathname === '/') {
    return hasPermission(role, 'dashboard.view');
  }

  if (pathname.startsWith('/domains')) {
    return hasPermission(role, 'domains.submit') || hasPermission(role, 'domains.manage');
  }

  if (pathname.startsWith('/nodes')) {
    return hasPermission(role, 'nodes.view');
  }

  if (pathname.startsWith('/logs')) {
    return hasPermission(role, 'logs.view');
  }

  if (pathname.startsWith('/settings')) {
    return hasPermission(role, 'settings.manage');
  }

  return !pathname.startsWith('/sign-');
}
