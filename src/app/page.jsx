'use client';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-provider';
import { ROLE_LABELS } from '@/lib/rbac';
import { SidebarNav } from '@/components/sidebar-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShieldCheck, ShieldAlert, Globe, Server } from 'lucide-react';
export default function DashboardPage() {
    const { userProfile } = useAuth();
    // Mock data
    const dnsQueryData = [
        { time: '00:00', allowed: 450, blocked: 23 },
        { time: '04:00', allowed: 380, blocked: 15 },
        { time: '08:00', allowed: 520, blocked: 42 },
        { time: '12:00', allowed: 680, blocked: 58 },
        { time: '16:00', allowed: 590, blocked: 35 },
        { time: '20:00', allowed: 720, blocked: 71 },
        { time: '24:00', allowed: 600, blocked: 48 },
    ];
    const threatData = [
        { category: 'Malware', count: 128 },
        { category: 'Phishing', count: 95 },
        { category: 'Botnet', count: 47 },
        { category: 'C2', count: 23 },
        { category: 'Other', count: 12 },
    ];
    const stats = [
        {
            title: 'Total DNS Queries',
            value: '73,500',
            description: 'Last 24 hours',
            icon: Globe,
            color: 'text-blue-500',
        },
        {
            title: 'Queries Blocked',
            value: '4,263',
            description: 'Malicious domains detected',
            icon: ShieldAlert,
            color: 'text-red-500',
        },
        {
            title: 'Block Rate',
            value: '5.8%',
            description: 'Of total queries',
            icon: ShieldCheck,
            color: 'text-green-500',
        },
        {
            title: 'DNS Node',
            value: '1',
            description: 'Philippines - Online',
            icon: Server,
            color: 'text-purple-500',
        },
    ];
    const recentBlocks = [
        { domain: 'malware.example.com', threat: 'Malware', time: '2 minutes ago' },
        { domain: 'phishing-site.net', threat: 'Phishing', time: '15 minutes ago' },
        { domain: 'botnet-command.io', threat: 'Botnet', time: '1 hour ago' },
        { domain: 'malicious-ads.com', threat: 'Malware', time: '3 hours ago' },
        { domain: 'exploit-kit.org', threat: 'Exploit', time: '5 hours ago' },
    ];
    return (<AuthGuard>
      <div className="min-h-screen bg-background">
        <SidebarNav />

        <main className="ml-64 p-8">
          <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-muted-foreground">ATRAVA Domain Defense - DNS Security Overview</p>
            {userProfile && (<p className="text-sm text-primary mt-2">Signed in as {ROLE_LABELS[userProfile.role]}</p>)}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => {
            const Icon = stat.icon;
            return (<Card key={stat.title} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                      <Icon className={`w-5 h-5 ${stat.color}`}/>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground mb-1">{stat.value}</div>
                    <CardDescription className="text-xs">{stat.description}</CardDescription>
                  </CardContent>
                </Card>);
        })}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* DNS Activity Chart */}
            <Card className="lg:col-span-2 bg-card border-border">
              <CardHeader>
                <CardTitle>DNS Activity (24h)</CardTitle>
                <CardDescription>Allowed vs Blocked queries</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dnsQueryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a"/>
                    <XAxis dataKey="time" stroke="#666"/>
                    <YAxis stroke="#666"/>
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} labelStyle={{ color: '#fff' }}/>
                    <Line type="monotone" dataKey="allowed" stroke="#3b82f6" strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="blocked" stroke="#ef4444" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Threats by Category */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Threats by Category</CardTitle>
                <CardDescription>Blacklist breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={threatData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a"/>
                    <XAxis type="number" stroke="#666"/>
                    <YAxis dataKey="category" type="category" stroke="#666" width={90}/>
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} labelStyle={{ color: '#fff' }}/>
                    <Bar dataKey="count" fill="#3b82f6"/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Blocks */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Recent Blocks</CardTitle>
              <CardDescription>Latest domains blocked by ATRAVA Domain Defense</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentBlocks.map((block, idx) => (<div key={idx} className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{block.domain}</p>
                      <p className="text-sm text-muted-foreground">{block.time}</p>
                    </div>
                    <Badge variant="destructive">{block.threat}</Badge>
                  </div>))}
              </div>
            </CardContent>
          </Card>
          </div>
        </main>
      </div>
    </AuthGuard>);
}
