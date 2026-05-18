'use client';

import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-provider';
import { SidebarNav } from '@/components/sidebar-nav';
import { PermissionBanner } from '@/components/permission-banner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddDomainDialog, BulkImportDialog } from '@/components/domain-dialogs';
import { hasPermission } from '@/lib/rbac';
import { Search, Trash2, Eye } from 'lucide-react';
import { useState } from 'react';

export default function DomainsPage() {
  const { userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('blacklist');
  const canManageDomains = hasPermission(userProfile?.role, 'domains.manage');
  const canSubmitDomains = canManageDomains || hasPermission(userProfile?.role, 'domains.submit');

  // Mock data
  const blacklistedDomains = [
    {
      id: '1',
      domain: 'malware.example.com',
      threatLevel: 'critical',
      sources: ['malware', 'botnet'],
      addedAt: '2024-05-18',
      addedBy: 'admin@company.com',
    },
    {
      id: '2',
      domain: 'phishing-site.net',
      threatLevel: 'high',
      sources: ['phishing'],
      addedAt: '2024-05-17',
      addedBy: 'threat-intel@company.com',
    },
    {
      id: '3',
      domain: 'botnet-command.io',
      threatLevel: 'critical',
      sources: ['botnet', 'c2'],
      addedAt: '2024-05-16',
      addedBy: 'automated',
    },
    {
      id: '4',
      domain: 'malicious-ads.com',
      threatLevel: 'medium',
      sources: ['malware'],
      addedAt: '2024-05-15',
      addedBy: 'admin@company.com',
    },
  ];

  const whitelistedDomains = [
    {
      id: '1',
      domain: 'trusted-vendor.com',
      reason: 'Vendor API access',
      addedAt: '2024-05-10',
      addedBy: 'admin@company.com',
    },
    {
      id: '2',
      domain: 'safe-cdn.net',
      reason: 'Content delivery network',
      addedAt: '2024-05-08',
      addedBy: 'network-admin@company.com',
    },
  ];

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-900 text-red-100';
      case 'high':
        return 'bg-orange-900 text-orange-100';
      case 'medium':
        return 'bg-yellow-900 text-yellow-100';
      default:
        return 'bg-gray-900 text-gray-100';
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <SidebarNav />

        <main className="ml-64 p-8">
          <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Domain Management</h1>
            <p className="text-muted-foreground">Manage blacklisted and whitelisted domains</p>
          </div>

          {!canManageDomains && canSubmitDomains && (
            <PermissionBanner message="Analysts can submit blacklist and whitelist changes for review, but destructive enforcement actions remain restricted to admins." />
          )}

          {/* Action Buttons */}
          {canSubmitDomains && (
            <div className="flex gap-4 mb-8 w-80">
              <AddDomainDialog
                type={activeTab === 'blacklist' ? 'blacklist' : 'whitelist'}
                triggerLabel={canManageDomains ? undefined : 'Submit Domain'}
                submitLabel={canManageDomains ? undefined : 'Submit for Review'}
              />
              <BulkImportDialog
                type={activeTab === 'blacklist' ? 'blacklist' : 'whitelist'}
                triggerLabel={canManageDomains ? undefined : 'Submit Bulk Import'}
                submitLabel={canManageDomains ? undefined : 'Submit Import for Review'}
              />
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="blacklist">Blacklist</TabsTrigger>
              <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
            </TabsList>

            {/* Blacklist Tab */}
            <TabsContent value="blacklist" className="mt-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Blacklisted Domains</CardTitle>
                      <CardDescription>Domains blocked from accessing your network</CardDescription>
                    </div>
                    <Badge variant="destructive" className="text-lg px-4 py-2">
                      {blacklistedDomains.length} domains
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Search */}
                  <div className="mb-6 relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search domains..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-secondary border-border"
                    />
                  </div>

                  {/* Domain List */}
                  <div className="space-y-3">
                    {blacklistedDomains.map((domain) => (
                      <div
                        key={domain.id}
                        className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border hover:border-primary transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{domain.domain}</div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getThreatLevelColor(domain.threatLevel)}`}>
                              {domain.threatLevel}
                            </span>
                            {domain.sources.map((source) => (
                              <Badge key={source} variant="outline" className="text-xs">
                                {source}
                              </Badge>
                            ))}
                            <span className="text-xs text-muted-foreground">Added {domain.addedAt}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canManageDomains && (
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Whitelist Tab */}
            <TabsContent value="whitelist" className="mt-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Whitelisted Domains</CardTitle>
                      <CardDescription>Domains always allowed to access your network</CardDescription>
                    </div>
                    <Badge className="text-lg px-4 py-2 bg-green-900 text-green-100">
                      {whitelistedDomains.length} domains
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Search */}
                  <div className="mb-6 relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search domains..."
                      className="pl-10 bg-secondary border-border"
                    />
                  </div>

                  {/* Domain List */}
                  <div className="space-y-3">
                    {whitelistedDomains.map((domain) => (
                      <div
                        key={domain.id}
                        className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border hover:border-primary transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{domain.domain}</div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {domain.reason}
                            </Badge>
                            <span className="text-xs text-muted-foreground">Added {domain.addedAt}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canManageDomains && (
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
