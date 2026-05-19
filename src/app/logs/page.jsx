'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AuthGuard } from '@/components/auth-guard';
import { SidebarNav } from '@/components/sidebar-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { Download, FileSearch, Search } from 'lucide-react';

function formatTimestamp(value) {
  if (!value) return 'Unknown time';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function detailText(details) {
  if (!details) return 'No additional details.';
  if (typeof details === 'string') return details;
  if (typeof details === 'object') {
    if (details.domain && details.type) {
      return `${details.domain} (${details.type})`;
    }
    if (details.domain) return String(details.domain);
    if (details.reason) return String(details.reason);
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join(' • ');
  }
  return String(details);
}

export default function LogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    const logsQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      setAuditLogs(snapshot.docs.map((logDoc) => ({ id: logDoc.id, ...logDoc.data() })));
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const domainText = detailText(log.details).toLowerCase();
      const matchesSearch =
        !queryText ||
        String(log.userId || '').toLowerCase().includes(queryText) ||
        String(log.action || '').toLowerCase().includes(queryText) ||
        domainText.includes(queryText);
      const matchesFilter = actionFilter === 'all' || log.action === actionFilter;
      return matchesSearch && matchesFilter;
    });
  }, [actionFilter, auditLogs, searchQuery]);

  const getActionLabel = (action) => {
    switch (action) {
      case 'domain_added':
        return 'Domain Added';
      case 'domain_removed':
        return 'Domain Removed';
      case 'bulk_import':
        return 'Bulk Import';
      case 'whitelist_added':
        return 'Whitelist Added';
      case 'whitelist_removed':
        return 'Whitelist Removed';
      case 'node_sync':
      case 'policies_synced':
        return 'Node Sync';
      case 'node_health_check':
        return 'Health Check';
      case 'settings_updated':
        return 'Settings Updated';
      default:
        return String(action || 'Unknown Action').replace(/_/g, ' ');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'bg-green-900 text-green-100';
      case 'warning':
        return 'bg-yellow-900 text-yellow-100';
      case 'error':
        return 'bg-red-900 text-red-100';
      default:
        return 'bg-gray-900 text-gray-100';
    }
  };

  const getActionColor = (action) => {
    if (String(action).includes('added') || String(action).includes('import')) return 'bg-blue-900 text-blue-100';
    if (String(action).includes('removed')) return 'bg-red-900 text-red-100';
    if (String(action).includes('sync')) return 'bg-purple-900 text-purple-100';
    return 'bg-gray-900 text-gray-100';
  };

  return (
    <AuthGuard permission="logs.view">
      <div className="min-h-screen bg-background">
        <SidebarNav />

        <main className="ml-64 p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-bold text-foreground">Audit Logs</h1>
              <p className="text-muted-foreground">Track all system activities and configuration changes</p>
            </div>

            <div className="mb-8 flex flex-wrap gap-4">
              <div className="relative min-w-64 flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by domain, user, or action..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-border bg-secondary pl-10"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-40 border-border bg-secondary">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="domain_added">Domain Added</SelectItem>
                  <SelectItem value="domain_removed">Domain Removed</SelectItem>
                  <SelectItem value="bulk_import">Bulk Import</SelectItem>
                  <SelectItem value="whitelist_added">Whitelist Added</SelectItem>
                  <SelectItem value="node_sync">Node Sync</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="flex items-center gap-2" disabled>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Activity Log</CardTitle>
                    <CardDescription>
                      Showing {filteredLogs.length} of {auditLogs.length} entries
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-secondary p-4 transition-colors hover:border-primary"
                      >
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            <Badge className={getActionColor(log.action)}>{getActionLabel(log.action)}</Badge>
                            <Badge className={getStatusColor(log.status)}>{String(log.status || 'unknown').toUpperCase()}</Badge>
                            <span className="text-sm text-muted-foreground">{formatTimestamp(log.timestamp)}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground">{detailText(log.details)}</p>
                          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                            <span>By: {log.userId || 'unknown'}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-muted-foreground">
                          View
                        </Button>
                      </div>
                    ))
                  ) : (
                    <Empty className="border border-dashed border-border bg-secondary/40">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <FileSearch />
                        </EmptyMedia>
                        <EmptyTitle>No logs found</EmptyTitle>
                        <EmptyDescription>
                          Audit activity will appear here as domains, nodes, and settings change.
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
