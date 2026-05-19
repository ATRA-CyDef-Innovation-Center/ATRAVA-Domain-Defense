'use client';
import { AuthGuard } from '@/components/auth-guard';
import { SidebarNav } from '@/components/sidebar-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download } from 'lucide-react';
import { useState } from 'react';
export default function LogsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    // Mock data
    const auditLogs = [
        {
            id: '1',
            timestamp: '2024-05-18 14:35:22',
            user: 'admin@company.com',
            action: 'domain_added',
            domain: 'malware.example.com',
            details: 'Added to blacklist (threat level: critical)',
            status: 'success',
        },
        {
            id: '2',
            timestamp: '2024-05-18 14:22:15',
            user: 'threat-intel@company.com',
            action: 'bulk_import',
            domain: '—',
            details: 'Imported 127 domains from CSV file',
            status: 'success',
        },
        {
            id: '3',
            timestamp: '2024-05-18 13:45:08',
            user: 'admin@company.com',
            action: 'domain_removed',
            domain: 'false-positive.com',
            details: 'Removed from blacklist (false positive)',
            status: 'success',
        },
        {
            id: '4',
            timestamp: '2024-05-18 13:15:42',
            user: 'network-admin@company.com',
            action: 'whitelist_added',
            domain: 'trusted-vendor.com',
            details: 'Added to whitelist',
            status: 'success',
        },
        {
            id: '5',
            timestamp: '2024-05-18 12:30:19',
            user: 'admin@company.com',
            action: 'node_sync',
            domain: '—',
            details: 'Synced policies to all DNS nodes',
            status: 'success',
        },
        {
            id: '6',
            timestamp: '2024-05-18 11:55:33',
            user: 'automated',
            action: 'node_health_check',
            domain: '—',
            details: 'Health check: B2 node showing uptime degradation (95.2%)',
            status: 'warning',
        },
        {
            id: '7',
            timestamp: '2024-05-18 10:20:11',
            user: 'admin@company.com',
            action: 'settings_updated',
            domain: '—',
            details: 'Updated DNS query logging policy',
            status: 'success',
        },
        {
            id: '8',
            timestamp: '2024-05-17 16:45:00',
            user: 'admin@company.com',
            action: 'domain_added',
            domain: 'botnet-command.io',
            details: 'Added to blacklist (sources: botnet, c2)',
            status: 'success',
        },
    ];
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
            case 'node_sync':
                return 'Node Sync';
            case 'node_health_check':
                return 'Health Check';
            case 'settings_updated':
                return 'Settings Updated';
            default:
                return action;
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
        if (action.includes('added') || action.includes('import')) {
            return 'bg-blue-900 text-blue-100';
        }
        else if (action.includes('removed')) {
            return 'bg-red-900 text-red-100';
        }
        else if (action.includes('sync')) {
            return 'bg-purple-900 text-purple-100';
        }
        return 'bg-gray-900 text-gray-100';
    };
    const filteredLogs = auditLogs.filter((log) => {
        const matchesSearch = log.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.details.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = actionFilter === 'all' || log.action === actionFilter;
        return matchesSearch && matchesFilter;
    });
    return (<AuthGuard permission="logs.view">
      <div className="min-h-screen bg-background">
        <SidebarNav />

        <main className="ml-64 p-8">
          <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Audit Logs</h1>
            <p className="text-muted-foreground">Track all system activities and configuration changes</p>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-8 flex-wrap">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground"/>
              <Input placeholder="Search by domain, user, or action..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-secondary border-border"/>
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-40 bg-secondary border-border">
                <SelectValue placeholder="All Actions"/>
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
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4"/>
              Export
            </Button>
          </div>

          {/* Logs Table */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activity Log</CardTitle>
                  <CardDescription>Showing {filteredLogs.length} of {auditLogs.length} entries</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredLogs.length > 0 ? (filteredLogs.map((log) => (<div key={log.id} className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border hover:border-primary transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={getActionColor(log.action)}>
                            {getActionLabel(log.action)}
                          </Badge>
                          <Badge className={getStatusColor(log.status)}>
                            {log.status.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{log.timestamp}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground">{log.details}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>By: {log.user}</span>
                          {log.domain !== '—' && <span>Domain: {log.domain}</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        View
                      </Button>
                    </div>))) : (<div className="text-center py-12">
                    <p className="text-muted-foreground">No logs found matching your filters</p>
                  </div>)}
              </div>
            </CardContent>
          </Card>
          </div>
        </main>
      </div>
    </AuthGuard>);
}
