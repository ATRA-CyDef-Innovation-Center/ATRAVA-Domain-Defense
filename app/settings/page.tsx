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
import { db } from '@/lib/firebase';
import { ROLE_LABELS } from '@/lib/rbac';
import type { User as AppUser } from '@/lib/types';
import { Save } from 'lucide-react';

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
    // In production, would save to Firebase
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
                  {/* Organization Name */}
                  <div className="space-y-2">
                    <Label htmlFor="org-name" className="text-foreground">
                      Organization Name
                    </Label>
                    <Input
                      id="org-name"
                      value={settings.organizationName}
                      onChange={(e) => handleChange('organizationName', e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>

                  {/* Admin Email */}
                  <div className="space-y-2">
                    <Label htmlFor="admin-email" className="text-foreground">
                      Admin Email
                    </Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={settings.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>

                  {/* Enable Logging */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground">Enable DNS Query Logging</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Log all DNS queries for audit purposes
                      </p>
                    </div>
                    <Switch
                      checked={settings.enableLogging}
                      onCheckedChange={(value) => handleChange('enableLogging', value)}
                    />
                  </div>

                  {/* Log Retention */}
                  <div className="space-y-2">
                    <Label htmlFor="log-retention" className="text-foreground">
                      Log Retention (days)
                    </Label>
                    <Input
                      id="log-retention"
                      type="number"
                      value={settings.logRetention}
                      onChange={(e) => handleChange('logRetention', e.target.value)}
                      className="bg-secondary border-border"
                    />
                    <p className="text-xs text-muted-foreground">
                      Logs older than this will be automatically deleted
                    </p>
                  </div>

                  {/* Enable Alerts */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground">Enable Alerts</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Receive alerts for critical events
                      </p>
                    </div>
                    <Switch
                      checked={settings.enableAlerts}
                      onCheckedChange={(value) => handleChange('enableAlerts', value)}
                    />
                  </div>

                  {/* Save Button */}
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
                    <Button asChild>
                      <a href="/sign-up">Add User</a>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {users.map((user) => (
                      <div
                        key={user.uid}
                        className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {user.displayName || user.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {user.email} · {ROLE_LABELS[user.role]}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-green-100 bg-green-900 px-2 py-1 rounded">
                            Active
                          </span>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
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
