'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Home,
  Globe,
  Settings,
  Activity,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth-provider';
import { ROLE_LABELS, hasPermission } from '@/lib/rbac';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand-logo';

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, logout } = useAuth();

  const navItems = [
    {
      title: 'Dashboard',
      href: '/',
      icon: Home,
      show: hasPermission(userProfile?.role, 'dashboard.view'),
    },
    {
      title: 'Domains',
      href: '/domains',
      icon: Globe,
      show:
        hasPermission(userProfile?.role, 'domains.submit') ||
        hasPermission(userProfile?.role, 'domains.manage'),
    },
    {
      title: 'DNS Nodes',
      href: '/nodes',
      icon: Activity,
      show: hasPermission(userProfile?.role, 'nodes.view'),
    },
    {
      title: 'Audit Logs',
      href: '/logs',
      icon: ShieldAlert,
      show: hasPermission(userProfile?.role, 'logs.view'),
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: Settings,
      show: hasPermission(userProfile?.role, 'settings.manage'),
    },
  ];

  const visibleNavItems = navItems.filter((item) => item.show);

  const handleLogout = async () => {
    await logout();
    router.replace('/sign-in');
  };

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <BrandLogo
            compact
            markClassName="h-9 w-9"
            textClassName="text-lg font-bold tracking-[0.22em] text-sidebar-foreground"
          />
        </div>

        {userProfile && (
          <div className="mb-6 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-4">
            <p className="text-sm font-medium text-sidebar-foreground">
              {userProfile.displayName || userProfile.email}
            </p>
            <p className="text-xs text-sidebar-foreground/70 mt-1">{userProfile.email}</p>
            <Badge className="mt-3 bg-sidebar-primary text-sidebar-primary-foreground">
              <ShieldCheck className="mr-1 h-3 w-3" />
              {ROLE_LABELS[userProfile.role]}
            </Badge>
          </div>
        )}

        <nav className="space-y-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="absolute bottom-6 left-6 right-6">
        <Button
          type="button"
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 px-4 py-3 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </Button>
      </div>
    </aside>
  );
}
