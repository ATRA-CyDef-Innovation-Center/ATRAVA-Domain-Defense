'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-provider';
import { ROLE_LABELS } from '@/lib/rbac';
import { SidebarNav } from '@/components/sidebar-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { db } from '@/lib/firebase';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Globe, Server, ShieldAlert } from 'lucide-react';

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePercent(value) {
  if (typeof value === 'number') return value;
  const numeric = Number.parseFloat(String(value || '0').replace('%', ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function relativeTime(value) {
  const date = normalizeDate(value);
  if (!date) return 'Unknown';
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((date.getTime() - Date.now()) / 60000),
    'minute'
  );
}

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [blacklistEntries, setBlacklistEntries] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    const unsubscribeNodes = onSnapshot(collection(db, 'nodes'), (snapshot) => {
      setNodes(snapshot.docs.map((nodeDoc) => ({ id: nodeDoc.id, ...nodeDoc.data() })));
    });

    const unsubscribeBlacklist = onSnapshot(collection(db, 'domains', 'blacklist', 'entries'), (snapshot) => {
      setBlacklistEntries(snapshot.docs.map((entryDoc) => ({ id: entryDoc.id, ...entryDoc.data() })));
    });

    const logsQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      setAuditLogs(snapshot.docs.map((logDoc) => ({ id: logDoc.id, ...logDoc.data() })));
    });

    return () => {
      unsubscribeNodes();
      unsubscribeBlacklist();
      unsubscribeLogs();
    };
  }, []);

  const dashboardStats = useMemo(() => {
    const totalQueries = nodes.reduce((sum, node) => sum + Number(node.queriesPerDay || 0), 0);
    const blockedQueries = nodes.reduce((sum, node) => {
      if (node.blockedQueries !== undefined) {
        return sum + Number(node.blockedQueries || 0);
      }
      const queries = Number(node.queriesPerDay || 0);
      const blockRate = parsePercent(node.blockRate) / 100;
      return sum + queries * blockRate;
    }, 0);
    const blockRate = totalQueries > 0 ? (blockedQueries / totalQueries) * 100 : 0;
    const onlineNodes = nodes.filter((node) => node.status === 'online').length;

    return [
      {
        title: 'Total DNS Queries',
        value: totalQueries.toLocaleString(),
        description: 'Reported by active nodes',
        icon: Globe,
        color: 'text-blue-500',
      },
      {
        title: 'Estimated Queries Blocked',
        value: Math.round(blockedQueries).toLocaleString(),
        description: 'Derived from node block rate',
        icon: ShieldAlert,
        color: 'text-red-500',
      },
      {
        title: 'Fleet Block Rate',
        value: `${blockRate.toFixed(1)}%`,
        description: 'Across all reporting nodes',
        icon: Activity,
        color: 'text-green-500',
      },
      {
        title: 'DNS Nodes Online',
        value: String(onlineNodes),
        description: `${nodes.length} total registered nodes`,
        icon: Server,
        color: 'text-cyan-500',
      },
    ];
  }, [nodes]);

  const policyActivityData = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 6 }, (_, index) => {
      const bucketStart = now - (5 - index) * 4 * 60 * 60 * 1000;
      return {
        time: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(bucketStart)),
        additions: 0,
        removals: 0,
      };
    });

    auditLogs.forEach((log) => {
      const timestamp = normalizeDate(log.timestamp);
      if (!timestamp) return;
      const diffMs = now - timestamp.getTime();
      if (diffMs < 0 || diffMs > 24 * 60 * 60 * 1000) return;
      const bucketIndex = Math.min(5, Math.floor((24 * 60 * 60 * 1000 - diffMs) / (4 * 60 * 60 * 1000)));
      if (bucketIndex < 0 || bucketIndex >= buckets.length) return;

      if (String(log.action).includes('added') || log.action === 'bulk_import') {
        buckets[bucketIndex].additions += 1;
      }
      if (String(log.action).includes('removed')) {
        buckets[bucketIndex].removals += 1;
      }
    });

    return buckets;
  }, [auditLogs]);

  const threatData = useMemo(() => {
    const counts = new Map();
    blacklistEntries.forEach((entry) => {
      const sources = Array.isArray(entry.sources) && entry.sources.length ? entry.sources : ['other'];
      sources.forEach((source) => {
        const label = String(source).trim() || 'other';
        counts.set(label, (counts.get(label) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([category, count]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [blacklistEntries]);

  const recentBlocks = useMemo(
    () =>
      [...blacklistEntries]
        .sort((a, b) => (normalizeDate(b.addedAt)?.getTime() || 0) - (normalizeDate(a.addedAt)?.getTime() || 0))
        .slice(0, 5),
    [blacklistEntries]
  );

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <SidebarNav />

        <main className="ml-64 p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground">ATRAVA Domain Defense live security overview</p>
              {userProfile && <p className="mt-2 text-sm text-primary">Signed in as {ROLE_LABELS[userProfile.role]}</p>}
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {dashboardStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.title} className="border-border bg-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                        <Icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-1 text-2xl font-bold text-foreground">{stat.value}</div>
                      <CardDescription className="text-xs">{stat.description}</CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="border-border bg-card lg:col-span-2">
                <CardHeader>
                  <CardTitle>Policy Activity (24h)</CardTitle>
                  <CardDescription>Blacklist and whitelist changes over the last 24 hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={policyActivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                      <XAxis dataKey="time" stroke="#666" />
                      <YAxis stroke="#666" allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} labelStyle={{ color: '#fff' }} />
                      <Line type="monotone" dataKey="additions" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="removals" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Threat Sources</CardTitle>
                  <CardDescription>Current blacklist source breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {threatData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={threatData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                        <XAxis type="number" stroke="#666" allowDecimals={false} />
                        <YAxis dataKey="category" type="category" stroke="#666" width={90} />
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} labelStyle={{ color: '#fff' }} />
                        <Bar dataKey="count" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty className="min-h-[300px] border border-dashed border-border bg-secondary/40">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <ShieldAlert />
                        </EmptyMedia>
                        <EmptyTitle>No blacklist data yet</EmptyTitle>
                        <EmptyDescription>
                          Threat breakdown will appear once domains are added to the blacklist.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Recent Blacklist Entries</CardTitle>
                <CardDescription>Latest domains added to ATRAVA Domain Defense</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentBlocks.length > 0 ? (
                    recentBlocks.map((block) => (
                      <div key={block.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary p-4">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{block.domain}</p>
                          <p className="text-sm text-muted-foreground">
                            Added {relativeTime(block.addedAt)} by {block.addedBy || 'unknown'}
                          </p>
                        </div>
                        <Badge variant="destructive">{block.threatLevel || 'unknown'}</Badge>
                      </div>
                    ))
                  ) : (
                    <Empty className="border border-dashed border-border bg-secondary/40">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <ShieldAlert />
                        </EmptyMedia>
                        <EmptyTitle>No blacklist activity yet</EmptyTitle>
                        <EmptyDescription>
                          Once domains are added to the blacklist, the latest entries will appear here.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
