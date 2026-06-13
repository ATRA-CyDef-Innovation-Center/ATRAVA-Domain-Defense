# ATRAVA Domain Defense

A comprehensive DNS-layer security platform for enforcing centralized domain policies across your network infrastructure. ATRAVA Domain Defense provides threat intelligence integration, node monitoring, and detailed audit logging. Currently deployed in the Philippines with support for adding additional nodes as needed.

## Overview

GCOT consists of three main components:

### 1. **Admin Dashboard** (Next.js + Firebase)

Web-based administration interface for managing DNS policies, monitoring node health, and reviewing audit logs.

### 2. **DNS Policy Agent** (Node.js)

Standalone service that runs on each DNS node, fetches policies from Firestore, and syncs them to CoreDNS.

### 3. **CoreDNS** (DNS Server)

Open-source DNS server configured to enforce blacklist/whitelist policies managed by GCOT.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GCOT Admin Dashboard                     │
│                    (Next.js + Tailwind)                     │
│                                                             │
│  • Domain Management (Blacklist/Whitelist)                 │
│  • DNS Node Monitoring                                     │
│  • Audit Logs & History                                    │
│  • Settings & Configuration                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │    Firebase (Firestore)      │
            │                              │
            │  • Domain Policies           │
            │  • Node Status               │
            │  • Audit Logs                │
            │  • System Configuration      │
            └──────────────────────────────┘
                           ▲
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
           ┌─────────────┐      ┌──────────────┐
           │Policy Agent │      │Health Monitor│
           └─────────────┘      └──────────────┘
                │
                ▼
      ┌──────────────────────────┐
      │  Philippines DNS Node    │
      │    (Manila, PH)          │
      └──────────────────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌──────────┐
│ Unbound│ │CoreDNS │ │Metrics   │
│ (Recur)│ │(Policy)│ │(Export)  │
└────────┘ └────────┘ └──────────┘
    │           │
    └───────────┴───────────┐
                            │
                            ▼
                  Internal Network Clients
                (DNS queries via Philippines node)
```

**Current Status**: Single Philippines DNS node active and ready for expansion

## Quick Start

### Prerequisites

- Node.js 18+ and npm/pnpm
- Firebase Project (with Firestore enabled)
- Docker (for CoreDNS deployment)
- Basic understanding of DNS concepts

### 1. Setup Firebase

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database
3. Create a service account in Settings → Service Accounts
4. Download the private key JSON

### 2. Deploy Frontend Dashboard

```bash
# Install dependencies
pnpm install

# Set Firebase environment variables (in Vercel Settings)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# Deploy to Vercel or run locally
pnpm dev
```

### 3. Deploy Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

### 4. Deploy DNS Agent

```bash
cd agent
npm install

# Create .env file
cp .env.example .env
# Edit .env with your node configuration

# Start agent
npm start
```

### 5. Deploy CoreDNS

```bash
# Using Docker Compose (recommended)
docker-compose -f deployment/docker-compose.yml up -d

# Or manually with systemd
sudo cp deployment/gcot-agent.service /etc/systemd/system/
sudo systemctl enable gcot-agent
sudo systemctl start gcot-agent
```

## Project Structure

```
/
├── app/                      # Next.js dashboard
│   ├── page.jsx             # Dashboard homepage
│   ├── domains/             # Domain management
│   ├── nodes/               # Node monitoring
│   ├── logs/                # Audit logs
│   ├── settings/            # System settings
│   └── globals.css          # Dark theme styling
│
├── components/              # React components
│   ├── sidebar-nav.jsx      # Navigation sidebar
│   ├── domain-dialogs.jsx   # Domain add/bulk import
│   └── ui/                  # shadcn/ui components
│
├── lib/                     # Shared utilities
│   ├── firebase.js          # Firebase initialization
│   ├── types.js             # Shared data shapes
│   └── firestore-utils.js   # Firestore helpers
│
├── functions/               # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.js         # Function exports
│   │   ├── domains.js       # Domain CRUD APIs
│   │   ├── nodes.js         # Node management APIs
│   │   └── audit.js         # Audit logging APIs
│   └── package.json
│
├── agent/                   # DNS Policy Agent (Node.js)
│   ├── src/
│   │   ├── index.js         # Agent main loop
│   │   ├── sync-manager.js  # Policy sync logic
│   │   ├── health-monitor.js # Node health checking
│   │   └── policy-cache.js  # In-memory policy cache
│   └── package.json
│
├── coredns/                 # CoreDNS configuration
│   ├── Corefile             # CoreDNS main config
│   └── policies.zone.example # Example zone file
│
├── deployment/              # Deployment configs
│   ├── docker-compose.yml   # Full stack deployment
│   └── gcot-agent.service   # Systemd service
│
├── GCOT_README.md           # This file
├── FIRESTORE_SETUP.md       # Firestore schema & setup
├── COREDNS_SETUP.md         # CoreDNS detailed guide
└── package.json
```

## Features

### Domain Management

- ✅ Add individual domains to blacklist/whitelist
- ✅ Bulk import from CSV/JSON files
- ✅ Threat level categorization (critical/high/medium/low)
- ✅ Threat source tagging (malware/phishing/botnet/c2/etc.)
- ✅ Domain history and audit trail

### Node Management

- ✅ Multi-node DNS deployment
- ✅ Real-time node status monitoring
- ✅ Health checks and uptime tracking
- ✅ Automatic policy synchronization
- ✅ Node version management

### Audit & Compliance

- ✅ Comprehensive audit logging
- ✅ User action tracking
- ✅ Policy change history
- ✅ Domain addition/removal logs
- ✅ 90-day automatic log retention

### Security

- ✅ Dark-themed enterprise interface
- ✅ Row-level security in Firestore (configurable)
- ✅ Encrypted credential storage
- ✅ Rate limiting on API endpoints
- ✅ Comprehensive error handling

## API Documentation

### Domain APIs

#### Add Blacklist Domain

```bash
curl -X POST https://[region]-gcot-project.cloudfunctions.net/domains-addBlacklistDomain \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "malware.example.com",
    "threatLevel": "critical",
    "sources": ["malware", "botnet"],
    "addedBy": "admin@company.com"
  }'
```

#### Bulk Import

```bash
curl -X POST https://[region]-gcot-project.cloudfunctions.net/domains-bulkImportDomains \
  -H "Content-Type: application/json" \
  -d '{
    "domains": [
      {
        "domain": "malware.com",
        "threatLevel": "critical",
        "sources": ["malware"]
      }
    ],
    "type": "blacklist",
    "importedBy": "threat-intel@company.com"
  }'
```

#### Get All Blacklist Domains

```bash
curl https://[region]-gcot-project.cloudfunctions.net/domains-getBlacklistDomains
```

### Node APIs

#### Register Node

```bash
curl -X POST https://[region]-gcot-project.cloudfunctions.net/nodes-registerNode \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "node-ph-01",
    "name": "Philippines DNS Node",
    "ip": "115.147.169.196",
    "version": "1.4.2"
  }'
```

#### Sync Policies to All Nodes

```bash
curl -X POST https://[region]-gcot-project.cloudfunctions.net/nodes-syncPoliciesToNodes
```

## Configuration

### Environment Variables

**Frontend (.env.local)**

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
```

**Agent (agent/.env)**

```bash
NODE_ID=node-ph-01
NODE_NAME="Philippines DNS Node"
NODE_IP=115.147.169.196
BLOCK_PAGE_IP=115.147.169.196
BLOCK_PAGE_URL=https://atrava-domain-defense.cisoasaservice.io/ntc-blocker
BLOCK_PAGE_PORT=80
BLOCK_PAGE_HTTPS_RESET_ENABLED=true
BLOCK_PAGE_HTTPS_PORT=443
PROXY_ENABLED=false
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key
SYNC_INTERVAL=60000
SYNC_DEBOUNCE_MS=500
HEALTH_CHECK_INTERVAL=120000
```

`BLOCK_PAGE_IP` is returned by DNS for blacklisted domains. The DNS node's block-page shim redirects HTTP requests to the WebGUI-hosted NTC page at `BLOCK_PAGE_URL` with the original blocked domain in the `domain` query parameter.

For HTTPS requests, publish TCP/443 and enable `BLOCK_PAGE_HTTPS_RESET_ENABLED` so blocked HTTPS attempts fail quickly instead of timing out. A browser-followable redirect for public HTTPS domains such as `facebook.com` is not possible with DNS-only blocking and no client-side TLS trust, because the browser validates the original hostname before it can read any redirect.

Policy changes are also watched through Firestore realtime listeners. `SYNC_INTERVAL` remains a fallback poll interval; dashboard blacklist changes should trigger node sync within the debounce window plus DNS reload time.

## Firestore Schema

### Collections

- **domains/blacklist/entries/{docId}** - Blacklisted domains
- **domains/whitelist/entries/{docId}** - Whitelisted domains
- **nodes/{nodeId}** - DNS node status and metrics
- **auditLogs/{docId}** - Audit log entries
- **nodeMetrics/{docId}** - Historical node metrics
- **\_system/policyManifest** - Current policy version
- **\_system/syncTrigger** - Sync trigger document

### Health Checks

- Dashboard: `http://localhost:3000`
- CoreDNS: `curl http://localhost:8080/health`

## Troubleshooting

See detailed guides:

- **Firebase Issues**: See [FIRESTORE_SETUP.md](./FIRESTORE_SETUP.md)
- **CoreDNS Issues**: See [COREDNS_SETUP.md](./COREDNS_SETUP.md)
- **Agent Issues**: Check `npm run dev` output

## Support & Contributing

- Issue Tracker: GitHub Issues
- Documentation: See included markdown files
- Example Configs: See `./coredns/` and `./deployment/` directories

## Security Best Practices

1. **Restrict Firebase Access**: Use service account with read-only permissions
2. **Network Segmentation**: Keep DNS nodes on isolated network segments
3. **TLS for Agent**: Use HTTPS for agent-to-Firestore communication
4. **Regular Updates**: Keep CoreDNS and Node.js updated
5. **Audit Logs**: Regularly review audit logs for suspicious activity
6. **Backups**: Backup Firestore regularly

## License

Proprietary - Global Chain of Trust (GCOT)

## Version

Current Version: 1.0.0 (MVP)

## Roadmap

Future enhancements:

- [ ] Multi-tenant support
- [ ] Advanced threat intelligence integration
- [ ] Machine learning-based threat detection
- [ ] Mobile app for quick policy updates
- [ ] Advanced analytics dashboard
- [ ] API authentication (OAuth/API keys)
- [ ] Database replication for HA
- [ ] Kubernetes native deployment
