'use client';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-provider';
import { SidebarNav } from '@/components/sidebar-nav';
import { PermissionBanner } from '@/components/permission-banner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hasPermission } from '@/lib/rbac';
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
export default function NodesPage() {
    const { userProfile } = useAuth();
    const canManageNodes = hasPermission(userProfile === null || userProfile === void 0 ? void 0 : userProfile.role, 'nodes.manage');
    // Mock data - Single Philippines DNS Node
    const nodes = [
        {
            id: '1',
            name: 'Philippines DNS Node',
            location: 'Manila, Philippines',
            ip: '203.158.xx.xx',
            status: 'online',
            version: '1.4.2',
            queriesPerDay: 73500,
            blockRate: '5.8%',
            lastSync: '1 minute ago',
            uptime: '99.8%',
            corednsStatus: 'online',
            unboundStatus: 'online',
        },
    ];
    const getStatusColor = (status) => {
        switch (status) {
            case 'online':
                return 'bg-green-900 text-green-100';
            case 'warning':
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
                return <CheckCircle className="w-5 h-5 text-green-500"/>;
            case 'warning':
                return <AlertCircle className="w-5 h-5 text-yellow-500"/>;
            case 'offline':
                return <AlertCircle className="w-5 h-5 text-red-500"/>;
            default:
                return null;
        }
    };
    return (<AuthGuard permission="nodes.view">
      <div className="min-h-screen bg-background">
        <SidebarNav />

        <main className="ml-64 p-8">
          <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">DNS Nodes</h1>
            <p className="text-muted-foreground">Philippines DNS node monitoring and management</p>
          </div>

          {!canManageNodes && (<PermissionBanner message="Your role can monitor node health and service status, but only admins can trigger synchronization or operational changes."/>)}

          {/* Action Buttons */}
          <div className="flex gap-4 mb-8">
            <Button variant="outline" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4"/>
              Refresh Status
            </Button>
          </div>

          {/* Nodes Grid */}
          <div className="grid grid-cols-1 gap-6">
            {nodes.map((node) => (<Card key={node.id} className="bg-card border-border">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div>{getStatusIcon(node.status)}</div>
                      <div className="flex-1">
                        <div>
                          <CardTitle className="text-lg">{node.name}</CardTitle>
                          <CardDescription className="text-sm mt-1">{node.location}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={getStatusColor(node.status)}>
                            {node.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* IP Address */}
                  <div className="mb-4 p-3 bg-secondary rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-1">IP Address</p>
                    <p className="font-mono text-sm text-foreground">{node.ip}</p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-3 bg-secondary rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Platform Version</p>
                      <p className="font-semibold text-foreground">{node.version}</p>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Queries Today</p>
                      <p className="font-semibold text-foreground">{node.queriesPerDay.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Block Rate</p>
                      <p className="font-semibold text-foreground">{node.blockRate}</p>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                      <p className="font-semibold text-foreground">{node.uptime}</p>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Last Policy Sync</p>
                      <p className="font-semibold text-foreground text-sm">{node.lastSync}</p>
                    </div>
                  </div>

                  {/* DNS Services Status */}
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-foreground mb-3">DNS Services</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
                        <p className="text-xs text-green-200 mb-1">CoreDNS</p>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500"/>
                          <p className="text-sm font-medium text-green-100">{node.corednsStatus}</p>
                        </div>
                      </div>
                      <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
                        <p className="text-xs text-green-200 mb-1">Unbound</p>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500"/>
                          <p className="text-sm font-medium text-green-100">{node.unboundStatus}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {canManageNodes && (<Button variant="outline" size="sm" className="flex-1">
                        Sync Now
                      </Button>)}
                    <Button variant="outline" size="sm" className="flex-1">
                      View Logs
                    </Button>
                  </div>
                </CardContent>
              </Card>))}
          </div>
          </div>
        </main>
      </div>
    </AuthGuard>);
}
