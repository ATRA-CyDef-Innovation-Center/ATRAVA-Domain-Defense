'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-provider';
import { SidebarNav } from '@/components/sidebar-nav';
import { PermissionBanner } from '@/components/permission-banner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { hasPermission } from '@/lib/rbac';
import { db } from '@/lib/firebase';
import { AlertCircle, CheckCircle, RefreshCw, Server } from 'lucide-react';

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatRelative(value) {
  const date = normalizeDate(value);
  if (!date) return 'Never';
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((date.getTime() - Date.now()) / 60000),
    'minute'
  );
}

function parsePercent(value) {
  if (typeof value === 'number') return value;
  const numeric = Number.parseFloat(String(value || '0').replace('%', ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function nodeQueryCount(node) {
  return Math.max(
    Number(node.unboundQueries || 0),
    Number(node.queriesPerDay || 0),
    Number(node.sampledQueries || 0),
    Number(node.blockedQueries || 0)
  );
}

export default function NodesPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [nodes, setNodes] = useState([]);

  const canManageNodes = hasPermission(userProfile?.role, 'nodes.manage');
  const actor = userProfile?.email || userProfile?.displayName || 'workspace-user';

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'nodes'), (snapshot) => {
      const items = snapshot.docs.map((nodeDoc) => ({
        id: nodeDoc.id,
        ...nodeDoc.data(),
      }));
      setNodes(items);
    });

    return () => unsubscribe();
  }, []);

  const sortedNodes = useMemo(
    () =>
      [...nodes].sort((a, b) => {
        const aTime = normalizeDate(a.lastSync)?.getTime() || 0;
        const bTime = normalizeDate(b.lastSync)?.getTime() || 0;
        return bTime - aTime;
      }),
    [nodes]
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return 'bg-green-900 text-green-100';
      case 'warning':
      case 'degraded':
        return 'bg-yellow-900 text-yellow-100';
      case 'offline':
        return 'bg-red-900 text-red-100';
      default:
        return 'bg-gray-900 text-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'offline':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const handleSyncNow = async () => {
    await setDoc(
      doc(db, '_system', 'syncTrigger'),
      {
        lastTriggered: new Date().toISOString(),
        requiresSync: true,
        reason: 'manual_sync',
      },
      { merge: true }
    );

    await addDoc(collection(db, 'auditLogs'), {
      action: 'node_sync',
      userId: actor,
      details: 'Manual policy sync requested from dashboard.',
      status: 'success',
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <AuthGuard permission="nodes.view">
      <div className="min-h-screen bg-background">
        <SidebarNav />

        <main className="ml-64 p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-bold text-foreground">DNS Nodes</h1>
              <p className="text-muted-foreground">Live node monitoring and management</p>
            </div>

            {!canManageNodes && (
              <PermissionBanner message="Your role can monitor node health and service status, but only admins can trigger synchronization or operational changes." />
            )}

            <div className="mb-8 flex gap-4">
              <Button variant="outline" className="flex items-center gap-2" onClick={() => router.refresh()}>
                <RefreshCw className="h-4 w-4" />
                Refresh Status
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {sortedNodes.length > 0 ? (
                sortedNodes.map((node) => {
                  const blockRate = parsePercent(node.blockRate);
                  const queries = nodeQueryCount(node);
                  const coreDnsStatus = node.corednsStatus || node.status || 'unknown';
                  const unboundStatus = node.unboundStatus || 'unknown';

                  return (
                    <Card key={node.id} className="border-border bg-card">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex flex-1 items-center gap-3">
                            <div>{getStatusIcon(node.status)}</div>
                            <div className="flex-1">
                              <div>
                                <CardTitle className="text-lg">{node.name || node.nodeId || node.id}</CardTitle>
                                <CardDescription className="mt-1 text-sm">
                                  {node.location || node.ip || 'Location unavailable'}
                                </CardDescription>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <Badge className={getStatusColor(node.status)}>{String(node.status || 'unknown').toUpperCase()}</Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4 rounded-lg border border-border bg-secondary p-3">
                          <p className="mb-1 text-xs text-muted-foreground">IP Address</p>
                          <p className="font-mono text-sm text-foreground">{node.ip || 'Unavailable'}</p>
                        </div>

                        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
                          <div className="rounded-lg border border-border bg-secondary p-3">
                            <p className="mb-1 text-xs text-muted-foreground">Platform Version</p>
                            <p className="font-semibold text-foreground">{node.version || 'Unknown'}</p>
                          </div>
                          <div className="rounded-lg border border-border bg-secondary p-3">
                            <p className="mb-1 text-xs text-muted-foreground">Queries Today</p>
                            <p className="font-semibold text-foreground">{queries.toLocaleString()}</p>
                          </div>
                          <div className="rounded-lg border border-border bg-secondary p-3">
                            <p className="mb-1 text-xs text-muted-foreground">Block Rate</p>
                            <p className="font-semibold text-foreground">{blockRate.toFixed(1)}%</p>
                          </div>
                          <div className="rounded-lg border border-border bg-secondary p-3">
                            <p className="mb-1 text-xs text-muted-foreground">Policy Matches</p>
                            <p className="font-semibold text-foreground">{Number(node.blockedQueries || 0).toLocaleString()}</p>
                          </div>
                          <div className="rounded-lg border border-border bg-secondary p-3">
                            <p className="mb-1 text-xs text-muted-foreground">Uptime</p>
                            <p className="font-semibold text-foreground">
                              {typeof node.uptime === 'number' ? `${node.uptime}%` : node.uptime || 'Unknown'}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-secondary p-3">
                            <p className="mb-1 text-xs text-muted-foreground">Last Policy Sync</p>
                            <p className="text-sm font-semibold text-foreground">{formatRelative(node.lastSync)}</p>
                          </div>
                        </div>

                        <div className="mb-6">
                          <p className="mb-3 text-sm font-semibold text-foreground">DNS Services</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-green-700 bg-green-900/20 p-3">
                              <p className="mb-1 text-xs text-green-200">CoreDNS</p>
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <p className="text-sm font-medium capitalize text-green-100">{coreDnsStatus}</p>
                              </div>
                            </div>
                            <div className="rounded-lg border border-green-700 bg-green-900/20 p-3">
                              <p className="mb-1 text-xs text-green-200">Unbound</p>
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <p className="text-sm font-medium capitalize text-green-100">{unboundStatus}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          {canManageNodes && (
                            <Button variant="outline" size="sm" className="flex-1" onClick={handleSyncNow}>
                              Sync Now
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => router.push('/logs')}>
                            View Logs
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Empty className="border border-dashed border-border bg-card">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Server />
                    </EmptyMedia>
                    <EmptyTitle>No DNS nodes registered</EmptyTitle>
                    <EmptyDescription>
                      Nodes will appear here once the agent checks in and writes status to Firestore.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
