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
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Database, Globe, Server, ShieldAlert, ShieldCheck } from 'lucide-react';

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

function nodeQueryCount(node) {
  return Math.max(
    Number(node.unboundQueries || 0),
    Number(node.queriesPerDay || 0),
    Number(node.policyTotalQueries || 0),
    Number(node.blockedQueries || 0)
  );
}

function nodePolicyQueryCount(node) {
  return Math.max(
    Number(node.policyTotalQueries || 0),
    Number(node.allowedQueries || 0) + Number(node.blockedQueries || 0),
    Number(node.sampledQueries || 0),
    Number(node.blockedQueries || 0)
  );
}

function nodeAllowedCount(node) {
  const allowed = Number(node.allowedQueries || 0);
  if (allowed > 0) return allowed;
  return Math.max(nodePolicyQueryCount(node) - nodeBlockedCount(node), 0);
}

function nodeBlockedCount(node) {
  return Number(node.blockedQueries || 0);
}

function syncLabel(node) {
  const status = String(node.syncStatus || 'unknown').toLowerCase();
  if (status === 'success') return 'Policy synced';
  if (status === 'pending') return 'Policy sync pending';
  if (status === 'error') return 'Policy sync error';
  return 'Policy sync unknown';
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
    const totalQueries = nodes.reduce((sum, node) => sum + nodeQueryCount(node), 0);
    const policyTotalQueries = nodes.reduce((sum, node) => sum + nodePolicyQueryCount(node), 0);
    const blockedQueries = nodes.reduce((sum, node) => sum + nodeBlockedCount(node), 0);
    const rateDenominator = policyTotalQueries || totalQueries;
    const blockRate = rateDenominator > 0 ? (blockedQueries / rateDenominator) * 100 : 0;
    const onlineNodes = nodes.filter((node) => node.status === 'online').length;
    const cacheHitRates = nodes
      .map((node) => Number(node.unboundCacheHitRate || 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    const avgCacheHitRate = cacheHitRates.length
      ? cacheHitRates.reduce((sum, value) => sum + value, 0) / cacheHitRates.length
      : 0;

    return [
      {
        title: 'Total DNS Queries',
        value: totalQueries.toLocaleString(),
        description: 'Cumulative activity from active nodes',
        icon: Globe,
        color: 'text-blue-500',
      },
      {
        title: 'Policy-Matched Queries',
        value: Math.round(blockedQueries).toLocaleString(),
        description: policyTotalQueries
          ? `From ${policyTotalQueries.toLocaleString()} cumulative DNS queries`
          : 'Cumulative DNS log counter',
        icon: ShieldAlert,
        color: 'text-red-500',
      },
      {
        title: 'Active Blacklist',
        value: blacklistEntries.length.toLocaleString(),
        description: 'Parent domains and subdomains',
        icon: ShieldCheck,
        color: 'text-emerald-500',
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
      {
        title: 'Cache Hit Rate',
        value: `${avgCacheHitRate.toFixed(1)}%`,
        description: 'Average across reporting nodes',
        icon: Database,
        color: 'text-violet-500',
      },
    ];
  }, [blacklistEntries.length, nodes]);

  const queryMixData = useMemo(() => {
    const allowedQueries = nodes.reduce((sum, node) => sum + nodeAllowedCount(node), 0);
    const blockedQueries = nodes.reduce((sum, node) => sum + nodeBlockedCount(node), 0);

    return [
      { name: 'Allowed', value: allowedQueries, color: '#22c55e' },
      { name: 'Blocked', value: blockedQueries, color: '#ef4444' },
    ].filter((item) => item.value > 0);
  }, [nodes]);

  const nodeHealthData = useMemo(
    () =>
      [...nodes]
        .map((node) => ({
          name: node.name || node.nodeId || node.id,
          queries: nodeQueryCount(node),
          allowed: nodeAllowedCount(node),
          blocked: nodeBlockedCount(node),
          policyQueries: nodePolicyQueryCount(node),
          blockRate: parsePercent(node.blockRate),
          cacheHitRate: Number(node.unboundCacheHitRate || 0),
          status: node.status || 'unknown',
          syncStatus: node.syncStatus || 'unknown',
          lastSeen: normalizeDate(node.lastHealthCheck || node.lastSync),
          lastSync: normalizeDate(node.lastSync),
        }))
        .sort((a, b) => b.queries - a.queries),
    [nodes]
  );

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

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
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
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>DNS Decisions</CardTitle>
                  <CardDescription>Allowed vs policy-matched traffic reported by nodes</CardDescription>
                </CardHeader>
                <CardContent>
                  {queryMixData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={queryMixData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={64}
                          outerRadius={92}
                          paddingAngle={4}
                        >
                          {queryMixData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} labelStyle={{ color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty className="min-h-[240px] border border-dashed border-border bg-secondary/40">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Activity />
                        </EmptyMedia>
                        <EmptyTitle>No DNS traffic yet</EmptyTitle>
                        <EmptyDescription>
                          Query decisions will appear after clients use the GCOT node.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    {queryMixData.map((item) => (
                      <div key={item.name} className="rounded-lg border border-border bg-secondary p-3">
                        <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </div>
                        <div className="font-semibold text-foreground">{item.value.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card lg:col-span-2">
                <CardHeader>
                  <CardTitle>Node Telemetry</CardTitle>
                  <CardDescription>Live resolver activity and enforcement health</CardDescription>
                </CardHeader>
                <CardContent>
                  {nodeHealthData.length > 0 ? (
                    <div className="space-y-3">
                      {nodeHealthData.map((node) => (
                        <div key={node.name} className="rounded-lg border border-border bg-secondary p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-foreground">{node.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Last seen {node.lastSeen ? relativeTime(node.lastSeen) : 'Unknown'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {syncLabel(node)}{node.lastSync ? ` ${relativeTime(node.lastSync)}` : ''}
                              </p>
                            </div>
                            <Badge className={node.status === 'online' ? 'bg-green-900 text-green-100' : 'bg-yellow-900 text-yellow-100'}>
                              {String(node.status).toUpperCase()}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                            <div>
                              <p className="text-xs text-muted-foreground">Resolver Queries</p>
                              <p className="font-semibold text-foreground">{node.queries.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Allowed</p>
                              <p className="font-semibold text-foreground">{node.allowed.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Policy Matches</p>
                              <p className="font-semibold text-foreground">{node.blocked.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Block Rate</p>
                              <p className="font-semibold text-foreground">{node.blockRate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Cache Hit</p>
                              <p className="font-semibold text-foreground">{node.cacheHitRate.toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty className="min-h-[240px] border border-dashed border-border bg-secondary/40">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Server />
                        </EmptyMedia>
                        <EmptyTitle>No node telemetry yet</EmptyTitle>
                        <EmptyDescription>
                          Resolver statistics will appear after the agent reports health.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </CardContent>
              </Card>
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
