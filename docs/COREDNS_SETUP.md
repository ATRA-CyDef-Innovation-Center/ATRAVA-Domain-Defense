# CoreDNS Setup Guide for GCOT

## Overview

This guide explains how to set up CoreDNS nodes that work with the GCOT system to implement DNS-level security filtering.

## Prerequisites

- Docker or Kubernetes cluster
- CoreDNS v1.10.0+
- Node.js 18+ (for the GCOT DNS Policy Agent)
- Firestore access credentials
- Internet connectivity to reach GCOT Firebase backend

## Installation

### Option 1: Docker Installation

```bash
# Pull CoreDNS image
docker pull coredns/coredns:latest

# Create directory structure
mkdir -p /etc/coredns
mkdir -p /var/lib/coredns

# Copy configuration files
cp ./coredns/Corefile /etc/coredns/
cp ./coredns/policies.zone /var/lib/coredns/
```

### Option 2: Linux System Installation

```bash
# Install CoreDNS
wget https://github.com/coredns/coredns/releases/download/v1.10.0/coredns_1.10.0_linux_amd64.tgz
tar -xzf coredns_1.10.0_linux_amd64.tgz
sudo mv coredns /usr/local/bin/

# Create user
sudo useradd -r -s /bin/false coredns

# Create directories
sudo mkdir -p /etc/coredns
sudo mkdir -p /var/lib/coredns
sudo chown -R coredns:coredns /var/lib/coredns
```

## CoreDNS Configuration

### Basic Corefile

Create `/etc/coredns/Corefile`:

```
. {
    # Log all DNS queries
    log

    # Health check endpoint
    health :8080

    # Generated hosts file for blacklisted domains.
    # Blacklisted domains resolve to the NTC block-page IP.
    hosts /var/lib/coredns/policies.zone {
        ttl 3600
        fallthrough
    }

    # Forward queries upstream
    forward . 8.8.8.8 8.8.4.4

    # Cache responses
    cache

    # Error handling
    errors
}
```

### Policy Zone File

The GCOT agent generates `/var/lib/coredns/policies.zone` automatically as a CoreDNS `hosts` file. Blacklisted domains resolve to the configured block-page IP:

```text
# GCOT policy hosts file

# === Blacklisted Domains ===
115.147.169.196 malware.example.com # threat: critical
115.147.169.196 phishing-site.net # threat: high
115.147.169.196 botnet-c2.org # threat: critical

# === Whitelisted Domains (Always Allowed) ===
# trusted-vendor.com
# safe-cdn.net
```

When a browser requests a blocked site, DNS points the domain to the block-page server on the DNS node. Plain HTTP requests are redirected to the WebGUI-hosted NTC page at `BLOCK_PAGE_URL?domain=<blocked-domain>`. HTTPS requests can also be redirected on TCP/443, but only after TLS succeeds for the original blocked hostname. For public HTTPS domains such as `facebook.com`, that requires a private inspection CA configured on the DNS node and trusted by client devices.

## GCOT DNS Policy Agent Setup

### Installation

```bash
# Navigate to agent directory
cd agent

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Configuration (.env)

```bash
# Node Identification
NODE_ID=node-ho-01                    # Unique ID for this DNS node
NODE_NAME="Head Office DNS"           # Human-readable name
NODE_IP=115.147.169.196                     # This node's IP address
BLOCK_PAGE_IP=115.147.169.196              # IP returned for blacklisted domains
BLOCK_PAGE_URL=https://atrava-domain-defense.cisoasaservice.io/ntc-blocker
BLOCK_PAGE_PORT=80
BLOCK_PAGE_HTTPS_ENABLED=true
BLOCK_PAGE_HTTPS_PORT=443
BLOCK_PAGE_CA_CERT_FILE=/opt/gcot-agent/certs/block-page-ca.crt
BLOCK_PAGE_CA_KEY_FILE=/opt/gcot-agent/certs/block-page-ca.key

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id

# CoreDNS Configuration
COREDNS_CONF_PATH=/etc/coredns/Corefile    # Path to CoreDNS Corefile

# Sync Settings (in milliseconds)
SYNC_INTERVAL=60000                   # Sync policies every 1 minute
HEALTH_CHECK_INTERVAL=120000          # Health check every 2 minutes
```

### Firebase Service Account

1. Go to Firebase Console → Settings → Service Accounts
2. Click "Generate New Private Key"
3. Export the Firebase Admin environment variables in your agent runtime

### Running the Agent

```bash
# Development
npm run dev

# Production (after build)
npm start
npm start

# Or with systemd (recommended)
sudo cp deployment/gcot-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gcot-agent
sudo systemctl start gcot-agent
```

## Docker Deployment

### Dockerfile Example

```dockerfile
FROM coredns/coredns:latest as coredns

FROM node:18-alpine

# Install CoreDNS
COPY --from=coredns /coredns /usr/local/bin/

# Install GCOT Agent
WORKDIR /opt/gcot-agent
COPY agent/package*.json ./
RUN npm install --only=production

COPY agent/src ./src
COPY agent/dist ./dist

# Create volumes
VOLUME ["/etc/coredns", "/var/lib/coredns"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start both CoreDNS and GCOT Agent
CMD sh -c "coredns -conf /etc/coredns/Corefile & node src/index.js"
```

### Docker Compose Example

```yaml
version: '3.8'

services:
    gcot-dns-node:
        build: .
        container_name: gcot-dns-node
        ports:
            - '53:53/udp'
            - '53:53/tcp'
            - '80:80/tcp' # Block-page HTTP redirect
            - '443:443/tcp' # Block-page HTTPS redirect with trusted CA
            - '8080:8080' # Health check
            - '8081:8081/tcp' # Explicit proxy
        volumes:
            - ./coredns/Corefile:/etc/coredns/Corefile:ro
            - coredns-data:/var/lib/coredns
            - ./agent/certs:/opt/gcot-agent/certs:ro
            - block-page-certs:/var/lib/gcot-agent/block-page-certs
            - ./.env.local:/opt/gcot-agent/.env.local:ro
        environment:
            NODE_ID: node-docker-01
            NODE_NAME: Docker DNS Node
            NODE_IP: 172.20.0.2
            BLOCK_PAGE_HTTPS_ENABLED: 'true'
            BLOCK_PAGE_HTTPS_PORT: 443
            BLOCK_PAGE_CERT_CACHE_DIR: /var/lib/gcot-agent/block-page-certs
            BLOCK_PAGE_CA_CERT_FILE: /opt/gcot-agent/certs/block-page-ca.crt
            BLOCK_PAGE_CA_KEY_FILE: /opt/gcot-agent/certs/block-page-ca.key
            NODE_ENV: production
        networks:
            - gcot-network
        restart: unless-stopped

volumes:
    block-page-certs:
    coredns-data:

networks:
    gcot-network:
```

## Network Configuration

### For Internal Network

Point client devices to the DNS node IP:

```bash
# Linux/Mac
echo "nameserver 115.147.169.196" | sudo tee /etc/resolv.conf

# Windows (in Network Settings)
# Set DNS Server to: 115.147.169.196
```

### For Multiple Nodes (HA Setup)

Configure load balancer or use round-robin DNS:

```bash
; DNS record for failover
gcot-dns.company.com.  IN  A  115.147.169.196   ; HO
gcot-dns.company.com.  IN  A  10.0.2.50   ; B1
gcot-dns.company.com.  IN  A  10.0.3.50   ; B2
```

## Health and Logs

### CoreDNS Health Check

```bash
curl http://localhost:8080/health
```

### Block-Page Redirect Checks

Verify the HTTP redirect directly before testing in a browser:

```bash
# From the DNS node host
curl -I -H 'Host: facebook.com' http://127.0.0.1/

# From a client network
curl -I -H 'Host: facebook.com' http://115.147.169.196/
```

Expected response:

```text
HTTP/1.1 302 Found
Location: https://atrava-domain-defense.cisoasaservice.io/ntc-blocker?domain=facebook.com
```

If these commands time out, TCP/80 is blocked by the host firewall, cloud firewall, or Docker port mapping.

For HTTPS redirects, clients must trust the CA configured in `BLOCK_PAGE_CA_CERT_FILE`; the agent uses that CA to issue a short-lived certificate for the blocked hostname seen in SNI:

```bash
curl -I --resolve facebook.com:443:115.147.169.196 --cacert /path/to/block-page-ca.crt https://facebook.com/
```

Expected response:

```text
HTTP/1.1 302 Found
Location: https://atrava-domain-defense.cisoasaservice.io/ntc-blocker?domain=facebook.com
```

If the CA is not trusted by the client, browsers reject the TLS handshake before any redirect can be followed.

### Explicit Proxy Check

The agent also starts an explicit proxy on `PROXY_PORT` (`8081` by default). Clients must be configured to use this proxy; DNS settings alone do not route browser traffic through it.

```bash
# HTTP request through the proxy should receive a redirect to the NTC page
curl -I -x http://115.147.169.196:8081 http://facebook.com/

# HTTPS CONNECT through the proxy is blocked, but browsers usually show a proxy
# error instead of following a redirect unless TLS interception or an endpoint
# agent is deployed.
curl -I -x http://115.147.169.196:8081 https://facebook.com/
```

### GCOT Agent Logs

```bash
# View logs
journalctl -u gcot-agent -f

# Or directly
npm run dev
```

## Troubleshooting

### Agent can't connect to Firestore

```bash
# Check Firebase config file
cat .env.local

# Verify network connectivity
curl https://firestore.googleapis.com
```

### Policies not syncing

```bash
# Check agent logs
journalctl -u gcot-agent -f

# Verify sync interval in .env
# Check _system/policyManifest in Firestore
```

### DNS not resolving

```bash
# Test CoreDNS directly
dig @127.0.0.1 example.com

# Check Corefile syntax
coredns -conf /etc/coredns/Corefile -test

# Check zone file
cat /var/lib/coredns/policies.zone
```

### High memory usage

```bash
# Reduce cache size in Corefile
cache 256

# Reduce log verbosity
# Remove or comment out "log" directive
```

## Security Best Practices

1. **Firewall**: Restrict DNS (port 53) to authorized networks only
2. **TLS/HTTPS**: Use DoT (DNS over TLS) or DoH (DNS over HTTPS) for client connections
3. **Service Account**: Restrict Firebase service account to read-only access
4. **Updates**: Keep CoreDNS and Node.js updated regularly
5. **Backups**: Back up Firestore data regularly

## Performance Tuning

### CoreDNS Optimization

```
. {
    cache 1024          # Increase cache size
    log                 # Log for debugging
    errors
    forward . 8.8.8.8 {
        policy round_robin
        max_concurrent 1000
    }
}
```

### Agent Optimization

Adjust in `.env`:

```bash
# Longer sync interval for stable environments
SYNC_INTERVAL=300000     # 5 minutes instead of 1 minute

# Adjust ulimits
ulimit -n 65536
```

## Next Steps

1. Test DNS resolution through the node
2. Monitor CoreDNS metrics for performance
3. Set up alerting for node failures
4. Configure backup/failover nodes
5. Integrate with a metrics collection system as needed.

For more information, see:

- CoreDNS Documentation: https://coredns.io
- GCOT Dashboard: See GCOT_DASHBOARD.md
