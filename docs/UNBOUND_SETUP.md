# Unbound Configuration for GCOT

## Overview

Unbound is a recursive DNS resolver that works in tandem with CoreDNS in the GCOT architecture:

- **Unbound**: Handles recursive DNS resolution, caching, and upstream queries
- **CoreDNS**: Enforces security policies (blacklist/whitelist) and decision-making
- **Policy Agent**: Synchronizes policies from GCOT Firebase backend to both services

## Architecture Flow

```
Client DNS Query
    ↓
Unbound (Recursive Resolver)
    ↓
CoreDNS (Policy Enforcement - via forward zone)
    ↓
Decision: Allow/Block
    ↓
Response back to Unbound → Client
```

## Installation

### Option 1: Docker

```bash
docker pull nlnetlabs/unbound:latest
docker run -d \
  --name unbound \
  -p 53:53/udp \
  -p 53:53/tcp \
  -v /etc/unbound:/etc/unbound \
  nlnetlabs/unbound:latest
```

### Option 2: System Package (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y unbound

# Enable and start service
sudo systemctl enable unbound
sudo systemctl start unbound
```

### Option 3: Compile from Source

```bash
# Install dependencies
sudo apt-get install -y build-essential openssl libssl-dev

# Download and compile
cd /tmp
wget https://nlnetlabs.nl/downloads/unbound/unbound-latest.tar.gz
tar -xzf unbound-latest.tar.gz
cd unbound-*
./configure --prefix=/usr/local/unbound
make && make install

# Create user
sudo useradd -r -s /bin/false unbound
sudo chown -R unbound:unbound /usr/local/unbound
```

## Unbound Configuration

### Main Configuration File: `/etc/unbound/unbound.conf`

```ini
# Server configuration
server:
    # Bind to all interfaces
    interface: 0.0.0.0
    interface: ::0
    port: 53
    
    # TCP configuration
    tcp-idle-timeout: 30000
    tcp-keepalive: 120000
    tcp-upstream: yes
    
    # Thread and cache settings
    num-threads: 4
    msg-cache-size: 100m
    rrset-cache-size: 200m
    
    # Security
    hide-identity: yes
    hide-version: yes
    qname-minimisation: yes
    rrset-roundrobin: yes
    
    # Logging
    logfile: "/var/log/unbound/unbound.log"
    log-queries: yes
    log-replies: yes
    log-tag-queryreply: yes
    verbosity: 1
    
    # Extended statistics
    extended-statistics: yes
    
    # Root hints (auto-updated)
    auto-trust-anchor-file: "/etc/unbound/root.key"
    
    # Local data (optional - for internal domains)
    local-zone: "local." static
    local-data: "ns.local. IN A 127.0.0.1"

# Forward all queries through CoreDNS for policy enforcement
forward-zone:
    name: "."
    forward-addr: 127.0.0.1@5053  # CoreDNS listening on port 5053
    forward-first: yes

# Remote control (for unbound-control management)
remote-control:
    control-enable: yes
    control-interface: 127.0.0.1
    control-port: 8953
    server-key-file: "/etc/unbound/unbound_server.key"
    server-cert-file: "/etc/unbound/unbound_server.pem"
    control-key-file: "/etc/unbound/unbound_control.key"
    control-cert-file: "/etc/unbound/unbound_control.pem"
```

### Generate Control Certificates

```bash
cd /etc/unbound
sudo unbound-control-setup
sudo chown unbound:unbound *.key *.pem
```

## CoreDNS Integration

CoreDNS should listen on a separate port (e.g., 5053) internally and receive forwarded queries from Unbound:

In CoreDNS **Corefile**:

```
localhost:5053 {
    # Policy enforcement plugins
    reload 10s
    log
    
    # Blacklist/whitelist zones from GCOT policies
    file /var/lib/coredns/policies.zone policies.local
    
    # Allow these to pass through to upstream
    forward . 8.8.8.8 1.1.1.1
    cache 3600
    prometheus :9153
}

# Public interface (returns REFUSED for direct queries)
.:53 {
    log
    errors
    health localhost:8080
}
```

## Policy Agent Integration

The GCOT DNS Policy Agent needs to manage both Unbound and CoreDNS:

### Agent Configuration (`agent/.env`)

```bash
# Unbound
UNBOUND_CONTROL_SOCKET=/var/run/unbound/unbound.ctl
UNBOUND_LOG_FILE=/var/log/unbound/unbound.log

# CoreDNS
COREDNS_CONFIG_FILE=/etc/coredns/Corefile
COREDNS_ZONE_FILE=/var/lib/coredns/policies.zone
COREDNS_RELOAD_ENDPOINT=http://localhost:9005/reload

# Firestore
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-email@appspot.gserviceaccount.com

# Node configuration
NODE_ID=gcot-node-1
NODE_ENVIRONMENT=production
SYNC_INTERVAL_SECONDS=300
HEALTH_CHECK_INTERVAL_SECONDS=60
```

### Agent Flow

1. **Fetch Policies** from Firestore
2. **Update CoreDNS Zone File** with blacklist/whitelist
3. **Reload CoreDNS** via API
4. **Query Unbound** status and cache
5. **Report Health** back to GCOT

### Agent Code Update

Add Unbound manager module to `agent/src/unbound-manager.js`:

```typescript
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import admin from 'firebase-admin';

export class UnboundManager {
  private unboundCtlSocket: string;
  private logFile: string;

  constructor(
    unboundCtlSocket: string = '/var/run/unbound/unbound.ctl',
    logFile: string = '/var/log/unbound/unbound.log'
  ) {
    this.unboundCtlSocket = unboundCtlSocket;
    this.logFile = logFile;
  }

  // Check Unbound status
  async getStatus(): Promise<any> {
    try {
      const stats = execSync('unbound-control stats', { encoding: 'utf-8' });
      return this.parseStats(stats);
    } catch (error) {
      console.error('[v0] Unbound status check failed:', error);
      return null;
    }
  }

  // Reload Unbound configuration
  async reload(): Promise<boolean> {
    try {
      execSync('unbound-control reload');
      console.log('[v0] Unbound reloaded successfully');
      return true;
    } catch (error) {
      console.error('[v0] Unbound reload failed:', error);
      return false;
    }
  }

  // Get Unbound cache statistics
  async getCacheStats(): Promise<{ hits: number; misses: number }> {
    try {
      const status = await this.getStatus();
      return {
        hits: parseInt(status?.['total.cachehits'] || '0'),
        misses: parseInt(status?.['total.cachemiss'] || '0'),
      };
    } catch (error) {
      console.error('[v0] Cache stats retrieval failed:', error);
      return { hits: 0, misses: 0 };
    }
  }

  // Parse unbound-control stats output
  private parseStats(stats: string): Record<string, string> {
    const result: Record<string, string> = {};
    stats.split('\n').forEach((line) => {
      const [key, value] = line.split('=');
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    });
    return result;
  }

  // Monitor Unbound logs for queries (optional)
  async getTailLogs(lines: number = 50): Promise<string[]> {
    try {
      const logs = execSync(`tail -n ${lines} ${this.logFile}`, {
        encoding: 'utf-8',
      });
      return logs.split('\n').filter((line) => line.trim());
    } catch (error) {
      console.error('[v0] Log retrieval failed:', error);
      return [];
    }
  }
}
```

## Systemd Service Files

### Unbound Service: `/etc/systemd/system/unbound.service`

```ini
[Unit]
Description=Unbound DNS Server (GCOT)
After=network.target
Wants=network-online.target

[Service]
Type=forking
User=unbound
Group=unbound
WorkingDirectory=/etc/unbound

ExecStart=/usr/sbin/unbound -c /etc/unbound/unbound.conf
ExecReload=/usr/sbin/unbound-control reload
ExecStop=/usr/sbin/unbound-control stop

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectClock=yes
ProtectHostname=yes
ProtectControlGroups=yes
LockPersonality=yes

# Resource limits
LimitNOFILE=1000000
LimitNPROC=512

# Restart policy
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable unbound
sudo systemctl start unbound
sudo systemctl status unbound
```

## Monitoring & Logging

### Enable Unbound Metrics (Prometheus)

Add to `unbound.conf`:

```ini
server:
    extended-statistics: yes
    statistics-interval: 0
    statistics-cumulative: no

remote-control:
    control-enable: yes
```

Export metrics via script (`unbound-metrics.sh`):

```bash
#!/bin/bash
while true; do
  unbound-control stats | awk '{print "unbound_" $1}' | sed 's/=/ /'
  sleep 60
done
```

### View Logs

```bash
# Real-time log viewing
sudo tail -f /var/log/unbound/unbound.log | grep -i "reply\|error\|warning"

# Count query types
sudo grep "query:" /var/log/unbound/unbound.log | awk '{print $NF}' | sort | uniq -c

# Monitor performance
sudo unbound-control stats | grep -E "queries|answers|cachemiss"
```

## Testing

### Test DNS Resolution

```bash
# Query through Unbound
dig @127.0.0.1 google.com
dig @127.0.0.1 malicious-domain.com  # Should be blocked by CoreDNS policy

# Check response from CoreDNS
dig @127.0.0.1 -p 5053 google.com  # Direct to CoreDNS

# Verbose query
dig +trace @127.0.0.1 example.com
```

### Test Unbound Control

```bash
# Get stats
unbound-control stats

# Check cache
unbound-control dump_cache | head -20

# Reload config
unbound-control reload

# Stop/start
unbound-control stop
unbound-control start
```

## Performance Tuning

### Increase Cache Size

```ini
server:
    msg-cache-size: 500m      # Increase for high-traffic nodes
    rrset-cache-size: 1000m
```

### Optimize Threading

```ini
server:
    num-threads: 8             # Match CPU core count
    outgoing-range: 8960      # Balanced with num-threads
    num-queries-per-thread: 4096
```

### Enable DNSSEC

```ini
server:
    dnssec: yes
    val-log-level: 2
    trust-anchor-file: "/etc/unbound/root.key"
```

## Troubleshooting

### Unbound won't start

```bash
# Check syntax
unbound-checkconf /etc/unbound/unbound.conf

# Check permissions
sudo chown -R unbound:unbound /etc/unbound /var/lib/unbound /var/log/unbound

# Check logs
sudo journalctl -u unbound -n 50
```

### High memory usage

- Reduce cache sizes in `unbound.conf`
- Enable cache persistence (not recommended for security)
- Monitor with `ps aux | grep unbound`

### CoreDNS not receiving forwarded queries

```bash
# Verify CoreDNS listening on port 5053
netstat -tlnp | grep 5053

# Check Unbound forward configuration
grep -A2 "forward-zone:" /etc/unbound/unbound.conf
```

## Next Steps

1. Set up both Unbound and CoreDNS
2. Configure the GCOT Policy Agent to manage both services
3. Deploy Node.js agent to run policy sync loop
4. Monitor via Prometheus and Grafana dashboards
5. Test blocking/allowing domains through the GCOT dashboard
