'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { hasPermission } from '@/lib/rbac';
import { db } from '@/lib/firebase';
import { Search, ShieldAlert, Trash2 } from 'lucide-react';

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = normalizeDate(value);
  if (!date) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function domainDocId(domain) {
  return String(domain).toLowerCase().trim().replace(/[^a-z0-9-]/g, '_');
}

function parseBulkContent(content, fileType, type) {
  if (fileType === 'json') {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        domain: String(item?.domain ?? '').trim().toLowerCase(),
        threatLevel: String(item?.threatLevel ?? 'medium').trim().toLowerCase(),
        sources: Array.isArray(item?.sources) ? item.sources.map((entry) => String(entry).trim().toLowerCase()) : [],
        reason: String(item?.reason ?? '').trim(),
      }))
      .filter((item) => item.domain);
  }

  const lines = String(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  return lines.slice(1).map((line) => {
    const [rawDomain = '', rawThreatLevel = 'medium', rawSourcesOrReason = ''] = line.split(',');
    const domain = rawDomain.trim().toLowerCase();
    if (type === 'blacklist') {
      return {
        domain,
        threatLevel: rawThreatLevel.trim().toLowerCase() || 'medium',
        sources: rawSourcesOrReason
          .replace(/^"|"$/g, '')
          .split(/[|,]/)
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean),
        reason: '',
      };
    }

    return {
      domain,
      threatLevel: 'low',
      sources: [],
      reason: [rawThreatLevel, rawSourcesOrReason].filter(Boolean).join(',').trim(),
    };
  }).filter((item) => item.domain);
}

export default function DomainsPage() {
  const { userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('blacklist');
  const [blacklistedDomains, setBlacklistedDomains] = useState([]);
  const [whitelistedDomains, setWhitelistedDomains] = useState([]);

  const canManageDomains = hasPermission(userProfile?.role, 'domains.manage');
  const canSubmitDomains = canManageDomains || hasPermission(userProfile?.role, 'domains.submit');
  const actor = userProfile?.email || userProfile?.displayName || 'workspace-user';

  useEffect(() => {
    const unsubscribeBlacklist = onSnapshot(
      collection(db, 'domains', 'blacklist', 'entries'),
      (snapshot) => {
        const items = snapshot.docs
          .map((entryDoc) => ({ id: entryDoc.id, ...entryDoc.data() }))
          .sort((a, b) => (normalizeDate(b.addedAt)?.getTime() || 0) - (normalizeDate(a.addedAt)?.getTime() || 0));
        setBlacklistedDomains(items);
      }
    );

    const unsubscribeWhitelist = onSnapshot(
      collection(db, 'domains', 'whitelist', 'entries'),
      (snapshot) => {
        const items = snapshot.docs
          .map((entryDoc) => ({ id: entryDoc.id, ...entryDoc.data() }))
          .sort((a, b) => (normalizeDate(b.addedAt)?.getTime() || 0) - (normalizeDate(a.addedAt)?.getTime() || 0));
        setWhitelistedDomains(items);
      }
    );

    return () => {
      unsubscribeBlacklist();
      unsubscribeWhitelist();
    };
  }, []);

  const filteredBlacklist = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return blacklistedDomains;
    return blacklistedDomains.filter((domain) =>
      String(domain.domain || '').toLowerCase().includes(query) ||
      String(domain.addedBy || '').toLowerCase().includes(query) ||
      (Array.isArray(domain.sources) && domain.sources.some((source) => String(source).toLowerCase().includes(query)))
    );
  }, [blacklistedDomains, searchQuery]);

  const filteredWhitelist = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return whitelistedDomains;
    return whitelistedDomains.filter((domain) =>
      String(domain.domain || '').toLowerCase().includes(query) ||
      String(domain.reason || '').toLowerCase().includes(query) ||
      String(domain.addedBy || '').toLowerCase().includes(query)
    );
  }, [whitelistedDomains, searchQuery]);

  const createAuditLog = async (action, details, status = 'success') => {
    await addDoc(collection(db, 'auditLogs'), {
      action,
      userId: actor,
      details,
      status,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
  };

  const triggerNodeSync = async (details = {}) => {
    const timestamp = new Date().toISOString();

    await setDoc(
      doc(db, '_system', 'policyManifest'),
      {
        timestamp,
        updatedAt: serverTimestamp(),
        updatedBy: actor,
        ...details,
      },
      { merge: true }
    );

    await setDoc(
      doc(db, '_system', 'syncTrigger'),
      {
        lastTriggered: timestamp,
        requiresSync: true,
      },
      { merge: true }
    );
  };

  const handleAddDomain = async (payload) => {
    const listType = activeTab === 'blacklist' ? 'blacklist' : 'whitelist';
    const cleanDomain = String(payload?.domain ?? '').trim().toLowerCase();
    if (!cleanDomain) return;

    const entry = {
      domain: cleanDomain,
      addedAt: new Date().toISOString(),
      addedBy: actor,
      ...(listType === 'blacklist'
        ? {
            threatLevel: payload?.threatLevel || 'medium',
            sources: Array.isArray(payload?.sources) ? payload.sources : [],
          }
        : {
            reason: String(payload?.reason ?? '').trim(),
          }),
    };

    await setDoc(doc(db, 'domains', listType, 'entries', domainDocId(cleanDomain)), entry, { merge: true });
    await createAuditLog(
      listType === 'blacklist' ? 'domain_added' : 'whitelist_added',
      {
        domain: cleanDomain,
        type: listType,
        ...(listType === 'blacklist'
          ? { threatLevel: entry.threatLevel, sources: entry.sources }
          : { reason: entry.reason }),
      }
    );
    await triggerNodeSync({ lastChange: 'domain_added', listType, domain: cleanDomain });
  };

  const handleBulkImport = async ({ content, fileType }) => {
    const listType = activeTab === 'blacklist' ? 'blacklist' : 'whitelist';
    const entries = parseBulkContent(content, fileType, listType);
    if (!entries.length) return;

    const batch = writeBatch(db);
    entries.forEach((entry) => {
      const record = {
        domain: entry.domain,
        addedAt: new Date().toISOString(),
        addedBy: actor,
        ...(listType === 'blacklist'
          ? {
              threatLevel: entry.threatLevel || 'medium',
              sources: entry.sources || [],
            }
          : {
              reason: entry.reason || '',
            }),
      };
      batch.set(doc(db, 'domains', listType, 'entries', domainDocId(entry.domain)), record, { merge: true });
    });

    await batch.commit();
    await createAuditLog('bulk_import', { count: entries.length, type: listType });
    await triggerNodeSync({ lastChange: 'bulk_import', listType, imported: entries.length });
  };

  const handleDeleteDomain = async (listType, domain) => {
    await deleteDoc(doc(db, 'domains', listType, 'entries', domain.id));
    await createAuditLog(
      listType === 'blacklist' ? 'domain_removed' : 'whitelist_removed',
      { domain: domain.domain, type: listType }
    );
    await triggerNodeSync({ lastChange: 'domain_removed', listType, domain: domain.domain });
  };

  const getThreatLevelColor = (level) => {
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
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-bold text-foreground">Domain Management</h1>
              <p className="text-muted-foreground">Manage blacklisted and whitelisted domains</p>
            </div>

            {!canManageDomains && canSubmitDomains && (
              <PermissionBanner message="Analysts can submit blacklist and whitelist changes for review, but destructive enforcement actions remain restricted to admins." />
            )}

            {canSubmitDomains && (
              <div className="mb-8 flex w-80 gap-4">
                <AddDomainDialog
                  type={activeTab === 'blacklist' ? 'blacklist' : 'whitelist'}
                  onSubmit={handleAddDomain}
                  triggerLabel={canManageDomains ? undefined : 'Submit Domain'}
                  submitLabel={canManageDomains ? undefined : 'Submit for Review'}
                />
                <BulkImportDialog
                  type={activeTab === 'blacklist' ? 'blacklist' : 'whitelist'}
                  onSubmit={handleBulkImport}
                  triggerLabel={canManageDomains ? undefined : 'Submit Bulk Import'}
                  submitLabel={canManageDomains ? undefined : 'Submit Import for Review'}
                />
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="blacklist">Blacklist</TabsTrigger>
                <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
              </TabsList>

              <TabsContent value="blacklist" className="mt-6">
                <Card className="border-border bg-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Blacklisted Domains</CardTitle>
                        <CardDescription>Domains blocked from accessing your network</CardDescription>
                      </div>
                      <Badge variant="destructive" className="px-4 py-2 text-lg">
                        {blacklistedDomains.length} domains
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="relative mb-6">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search domains..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="border-border bg-secondary pl-10"
                      />
                    </div>

                    <div className="space-y-3">
                      {filteredBlacklist.length > 0 ? (
                        filteredBlacklist.map((domain) => (
                          <div
                            key={domain.id}
                            className="flex items-center justify-between rounded-lg border border-border bg-secondary p-4 transition-colors hover:border-primary"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-foreground">{domain.domain}</div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${getThreatLevelColor(domain.threatLevel)}`}>
                                  {domain.threatLevel || 'unknown'}
                                </span>
                                {(domain.sources || []).map((source) => (
                                  <Badge key={source} variant="outline" className="text-xs">
                                    {source}
                                  </Badge>
                                ))}
                                <span className="text-xs text-muted-foreground">
                                  Added {formatDate(domain.addedAt)} by {domain.addedBy || 'unknown'}
                                </span>
                              </div>
                            </div>
                            {canManageDomains && (
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteDomain('blacklist', domain)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <Empty className="border border-dashed border-border bg-secondary/40">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <ShieldAlert />
                            </EmptyMedia>
                            <EmptyTitle>No blacklisted domains yet</EmptyTitle>
                            <EmptyDescription>
                              Domains added to the blacklist will appear here in real time.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="whitelist" className="mt-6">
                <Card className="border-border bg-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Whitelisted Domains</CardTitle>
                        <CardDescription>Domains always allowed to access your network</CardDescription>
                      </div>
                      <Badge className="bg-green-900 px-4 py-2 text-lg text-green-100">
                        {whitelistedDomains.length} domains
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="relative mb-6">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search domains..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="border-border bg-secondary pl-10"
                      />
                    </div>

                    <div className="space-y-3">
                      {filteredWhitelist.length > 0 ? (
                        filteredWhitelist.map((domain) => (
                          <div
                            key={domain.id}
                            className="flex items-center justify-between rounded-lg border border-border bg-secondary p-4 transition-colors hover:border-primary"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-foreground">{domain.domain}</div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {domain.reason && (
                                  <Badge variant="outline" className="text-xs">
                                    {domain.reason}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  Added {formatDate(domain.addedAt)} by {domain.addedBy || 'unknown'}
                                </span>
                              </div>
                            </div>
                            {canManageDomains && (
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteDomain('whitelist', domain)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <Empty className="border border-dashed border-border bg-secondary/40">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <ShieldAlert />
                            </EmptyMedia>
                            <EmptyTitle>No whitelisted domains yet</EmptyTitle>
                            <EmptyDescription>
                              Domains added to the whitelist will appear here in real time.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      )}
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
