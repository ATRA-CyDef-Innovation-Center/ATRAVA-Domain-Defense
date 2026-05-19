'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-provider';
import { SidebarNav } from '@/components/sidebar-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { ROLE_LABELS } from '@/lib/rbac';
import type { User as AppUser, UserRole } from '@/lib/types';
import { Save, UserPlus, Loader2, Link as LinkIcon } from 'lucide-react';

export default function SettingsPage() {
  const { userProfile } = useAuth();
  const [settings, setSettings] = useState({
    organizationName: 'ACME Corporation',
    email: 'admin@company.com',
    enableLogging: true,
    logRetention: '90',
    enableAlerts: true,
  });
  const [users, setUsers] = useState<AppUser[]>([]);

  // Invite state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccessLink, setInviteSuccessLink] = useState('');

  useEffect(() => {
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      setUsers(
        snapshot.docs.map((userDoc) => {
          const data = userDoc.data();
          return {
            uid: userDoc.id,
            email: data.email ?? '',
            displayName: data.displayName ?? '',
            role: data.role ?? 'viewer',
            status: data.status ?? 'active',
            source: data.source ?? 'manual',
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            lastLoginAt: data.lastLoginAt?.toDate?.(),
          } as AppUser;
        })
      );
    });

    return () => unsubscribe();
  }, []);

  const handleChange = (field: string, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    console.log('[v0] Settings saved:', settings);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsInviting(true);
    setInviteError('');
    setInviteSuccessLink('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send invite');
      }

      // Success
      if (data.link) {
        setInviteSuccessLink(data.link);
      } else {
        setIsInviteOpen(false); // close immediately if no manual link to show
      }
      setInviteEmail('');
      setInviteRole('viewer');
    } catch (err: any) {
      setInviteError(err.message);
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <AuthGuard permission="settings.manage">
      <div className="min-h-screen bg-background">
        <SidebarNav />

        <main className="ml-64 p-8">
          <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
            <p className="text-muted-foreground">Manage ATRAVA Domain Defense configuration and preferences</p>
            {userProfile && (
              <p className="text-sm text-primary mt-2">
                Admin access granted to {userProfile.displayName || userProfile.email}
              </p>
            )}
          </div>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="mt-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Configure basic system settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* General settings form remains unchanged */}
                  <div className="space-y-2">
                    <Label htmlFor="org-name" className="text-foreground">Organization Name</Label>
                    <Input
                      id="org-name"
                      value={settings.organizationName}
                      onChange={(e) => handleChange('organizationName', e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-email" className="text-foreground">Admin Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={settings.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground">Enable DNS Query Logging</Label>
                      <p className="text-sm text-muted-foreground mt-1">Log all DNS queries for audit purposes</p>
                    </div>
                    <Switch
                      checked={settings.enableLogging}
                      onCheckedChange={(value) => handleChange('enableLogging', value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="log-retention" className="text-foreground">Log Retention (days)</Label>
                    <Input
                      id="log-retention"
                      type="number"
                      value={settings.logRetention}
                      onChange={(e) => handleChange('logRetention', e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground">Enable Alerts</Label>
                      <p className="text-sm text-muted-foreground mt-1">Receive alerts for critical events</p>
                    </div>
                    <Switch
                      checked={settings.enableAlerts}
                      onCheckedChange={(value) => handleChange('enableAlerts', value)}
                    />
                  </div>

                  <div className="pt-6 border-t border-border">
                    <Button onClick={handleSave} className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Save Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* User Management */}
            <TabsContent value="users" className="mt-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>User Management</CardTitle>
                      <CardDescription>Manage team members and permissions</CardDescription>
                    </div>
                    
                    {/* Invite User Dialog */}
                    <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                      <DialogTrigger asChild>
                        <Button className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4" /> Invite User
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md border-border bg-card">
                        <DialogHeader>
                          <DialogTitle>Invite new user</DialogTitle>
                          <DialogDescription>
                            Send an invitation link for them to join this workspace.
                          </DialogDescription>
                        </DialogHeader>
                        
                        {!inviteSuccessLink ? (
                          <form onSubmit={handleInviteSubmit} className="space-y-4 py-2">
                            <div className="space-y-2">
                              <Label htmlFor="email">Email address</Label>
                              <Input
                                id="email"
                                type="email"
                                placeholder="name@company.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                required
                                className="bg-secondary"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="role">Role</Label>
                              <Select value={inviteRole} onValueChange={(val: UserRole) => setInviteRole(val)}>
                                <SelectTrigger className="w-full bg-secondary">
                                  <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                                  <SelectItem value="analyst">Analyst (Manage & View)</SelectItem>
                                  <SelectItem value="viewer">Viewer (Read Only)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {inviteError && (
                              <p className="text-sm font-medium text-red-500">{inviteError}</p>
                            )}

                            <DialogFooter className="mt-6">
                              <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                                Cancel
                              </Button>
                              <Button type="submit" disabled={isInviting}>
                                {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invite'}
                              </Button>
                            </DialogFooter>
                          </form>
                        ) : (
                          <div className="space-y-4 py-4">
                            <div className="rounded-md bg-green-500/10 p-4 border border-green-500/20">
                              <h3 className="text-sm font-medium text-green-500 mb-1">Invitation created!</h3>
                              <p className="text-xs text-muted-foreground">
                                The email integration is currently in dev mode. Share this link directly with the user:
                              </p>
                              <div className="mt-3 flex items-center gap-2 rounded bg-background p-2 border border-border">
                                <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                <code className="text-xs text-foreground truncate select-all">{inviteSuccessLink}</code>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={() => { setIsInviteOpen(false); setInviteSuccessLink(''); }}>
                                Done
                              </Button>
                            </DialogFooter>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {users.map((user) => {
                      // Determine status styling
                      const isPending = user.status === 'pending';
                      const isDisabled = user.status === 'disabled';
                      const isActive = !isPending && !isDisabled;
                      
                      return (
                        <div
                          key={user.uid}
                          className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {user.displayName || user.email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {user.email} · {ROLE_LABELS[user.role] ?? user.role}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full border ${
                              isPending 
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                                : isDisabled
                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            }`}>
                              {isPending ? 'Pending' : isDisabled ? 'Disabled' : 'Active'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {users.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">
                        No users found.
                      </p>
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
