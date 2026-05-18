'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { canAccessRoute, hasPermission } from '@/lib/rbac';
import type { Permission } from '@/lib/rbac';

export function AuthGuard({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission?: Permission;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!userProfile) {
      router.replace(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!canAccessRoute(userProfile.role, pathname)) {
      router.replace('/unauthorized');
    }
  }, [loading, pathname, router, userProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader>
            <CardTitle>Loading session</CardTitle>
            <CardDescription>Checking your ATRAVA Domain Defense access profile.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  if (permission && !hasPermission(userProfile.role, permission)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader>
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>Your current role cannot perform this action.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')}>Return to dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
