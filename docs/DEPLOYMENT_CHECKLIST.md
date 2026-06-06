# ATRAVA Domain Defense Deployment Checklist

## Pre-Deployment

- [ ] Review GCOT_README.md for architecture overview
- [ ] Review FIRESTORE_SETUP.md for database schema
- [ ] Review COREDNS_SETUP.md for DNS node setup
- [ ] Verify all code builds successfully (`pnpm build`)
- [ ] Create Firebase project in Google Cloud Console
- [ ] Enable Firestore Database (native mode, US region recommended)
- [ ] Create Firebase service account with Editor role

## Phase 1: Frontend Dashboard

### Local Development

- [ ] Install dependencies: `pnpm install`
- [ ] Create `.env.local` with Firebase config:
    ```
    NEXT_PUBLIC_FIREBASE_API_KEY=xxx
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
    NEXT_PUBLIC_FIREBASE_APP_ID=xxx
    ```
- [ ] Run dev server: `pnpm dev`
- [ ] Verify dashboard loads at http://localhost:3000
- [ ] Test all page navigation:
    - [ ] Dashboard (/)
    - [ ] Domains (/domains)
    - [ ] Nodes (/nodes)
    - [ ] Logs (/logs)
    - [ ] Settings (/settings)

### Production Deployment

- [ ] Deploy to Vercel: `git push origin main` (or use CLI)
- [ ] Set environment variables in Vercel Settings → Vars
- [ ] Verify deployment successful at your domain
- [ ] Test dashboard in production environment

## Phase 2: Firebase Setup

### Firestore Database

- [ ] Enable Firestore Database in Firebase Console
- [ ] Create collections:
    - [ ] `domains/blacklist/entries`
    - [ ] `domains/whitelist/entries`
    - [ ] `nodes`
    - [ ] `auditLogs`
    - [ ] `nodeMetrics`
    - [ ] `_system` (create policyManifest and syncTrigger docs)

### Firestore Security Rules

- [ ] Review security rules in FIRESTORE_SETUP.md
- [ ] Apply rules based on your authentication method:
    - Option 1: Allow all (development)
        ```
        rules_version = '3';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /{document=**} {
              allow read, write: if true;
            }
          }
        }
        ```
    - Option 2: Require authentication (production)
        ```
        rules_version = '3';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /{document=**} {
              allow read, write: if request.auth != null;
            }
          }
        }
        ```

### Firestore Indexes

- [ ] Create composite index for auditLogs:
    - [ ] Collection: `auditLogs`
    - [ ] Fields: `timestamp` (Descending), `userId` (Ascending)
    - [ ] Fields: `timestamp` (Descending), `action` (Ascending)

## Phase 3: Cloud Functions

### Deploy Functions

- [ ] Navigate to functions directory: `cd functions`
- [ ] Install dependencies: `npm install`
- [ ] Deploy to Firebase:
    ```bash
    firebase deploy --only functions
    ```
- [ ] Verify functions deployed in Firebase Console:
    - [ ] domains-addBlacklistDomain
    - [ ] domains-removeBlacklistDomain
    - [ ] domains-getBlacklistDomains
    - [ ] domains-bulkImportDomains
    - [ ] nodes-registerNode
    - [ ] nodes-getNodeStatus
    - [ ] nodes-updateNodeStatus
    - [ ] nodes-getAllNodes
    - [ ] nodes-syncPoliciesToNodes
    - [ ] audit-logAction
    - [ ] audit-getAuditLogs
    - [ ] audit-getAuditLogsByDateRange
    - [ ] audit-deleteOldAuditLogs
    - [ ] healthCheck

### Test Cloud Functions

- [ ] Test health check endpoint
- [ ] Test domain APIs (curl or Postman):
    - [ ] Add blacklist domain
    - [ ] Get blacklist domains
    - [ ] Remove domain
    - [ ] Bulk import
- [ ] Test node APIs:
    - [ ] Register node
    - [ ] Get node status
    - [ ] Sync policies

## Phase 4: DNS Policy Agent

### Agent Setup

- [ ] Navigate to agent directory: `cd agent`
- [ ] Install dependencies: `npm install`
- [ ] Prepare Firebase Admin environment variables

- [ ] Copy `.env.example` to `.env`
- [ ] Edit `.env` with node configuration:

    ```bash
    NODE_ID=node-ph-01
    NODE_NAME="Philippines DNS Node"
    NODE_IP=115.147.169.196

    SYNC_INTERVAL=60000
    HEALTH_CHECK_INTERVAL=120000
    ```

### Testing Agent (Dev)

- [ ] Run agent: `npm start`
- [ ] Verify logs show:
    - [ ] "Initializing Firebase..."
    - [ ] "Firebase initialized successfully"
    - [ ] "Node registered: node-ph-01"
    - [ ] "Starting initial policy sync..."
    - [ ] "Agent started successfully"
- [ ] Stop agent gracefully (Ctrl+C)
- [ ] Verify in Firestore:
- [ ] Node document created in `nodes/node-ph-01`
    - [ ] Status should be "offline" after graceful shutdown

## Phase 5: CoreDNS Setup

### Docker Deployment (Recommended)

- [ ] Copy Firebase config to deployment directory
- [ ] Verify docker-compose.yml configuration
- [ ] Start stack:
    ```bash
    docker-compose -f deployment/docker-compose.yml up -d
    ```
- [ ] Verify containers running:

    ```bash
    docker-compose ps
    ```

                      - [ ] gcot-dns-node (running)

### Manual Linux Installation (Alternative)

- [ ] Install CoreDNS: `curl | tar` (see COREDNS_SETUP.md)
- [ ] Copy Corefile to `/etc/coredns/Corefile`
- [ ] Create service user: `useradd -r coredns`
- [ ] Create systemd service at `/etc/systemd/system/gcot-agent.service`
- [ ] Enable and start:
    ```bash
    systemctl enable gcot-agent
    systemctl start gcot-agent
    ```

### Verify CoreDNS

- [ ] Test health endpoint: `curl http://localhost:8080/health`
- [ ] Test DNS resolution:
    ```bash
    dig @127.0.0.1 google.com
    dig @127.0.0.1 malware.example.com  # Should return NXDOMAIN
    ```

## Phase 6: Policy Management

### Add Initial Policies

- [ ] Log in to GCOT Dashboard
- [ ] Navigate to Domains page
- [ ] Add your first blacklisted domain:
    - [ ] Domain: (your threat domain)
    - [ ] Threat Level: critical
    - [ ] Sources: [malware]
    - [ ] Click "Add Domain"
- [ ] Verify domain appears in blacklist
- [ ] Wait 1 minute for agent sync
- [ ] Verify in CoreDNS logs: policy sync completed

### Bulk Import

- [ ] Prepare CSV file with format:
    ```
    domain,threat_level,sources
    malware.com,critical,malware
    phishing.net,high,phishing
    ```
- [ ] Navigate to Domains page
- [ ] Click "Bulk Import"
- [ ] Upload CSV file
- [ ] Verify import completes
- [ ] Wait for agent sync
- [ ] Test DNS blocking from client

## Phase 7: Node Monitoring

### Monitor Dashboard

- [ ] Check Nodes page in dashboard
- [ ] Verify node appears:
    - [ ] Status: online/warning
    - [ ] Uptime: > 0%
    - [ ] Queries/Day: should increase
    - [ ] Last Sync: recent time

### Generate Test Queries

- [ ] Configure client device to use CoreDNS node IP
- [ ] Try DNS queries:
    ```bash
    nslookup google.com          # Should resolve
    nslookup malware.example.com # Should return NXDOMAIN
    ```
- [ ] Check Nodes page:
    - [ ] Queries/Day increased
    - [ ] Block Rate updated

### Monitor Audit Logs

- [ ] Check Audit Logs page in dashboard
- [ ] Verify recent actions appear:
    - [ ] domain_added
    - [ ] node_registered
    - [ ] node_health_check
    - [ ] policies_synced

## Phase 8: Production Hardening

### Security

- [ ] Enable Firebase Authentication (OAuth/Email)

### Security

- [ ] Enable Firebase Authentication (OAuth/Email)
- [ ] Update Firestore security rules for auth
- [ ] Rotate service account keys
- [ ] Enable audit logging in Firebase
- [ ] Set up VPN/firewall for CoreDNS access
- [ ] Use TLS/HTTPS for agent-to-Firebase communication
- [ ] Configure rate limiting on Cloud Functions

### Backup & Recovery

- [ ] Set up Firestore automated backups
- [ ] Document backup recovery procedures
- [ ] Test backup restoration process
- [ ] Create runbooks for common issues

### Performance

- [ ] Adjust cache settings if needed
- [ ] Load test with DNS query tool
- [ ] Optimize upstream DNS servers

### High Availability

- [ ] Deploy second DNS node (B1)
- [ ] Verify policy sync to both nodes
- [ ] Test failover (stop primary, queries via secondary)
- [ ] Set up load balancer or DNS round-robin
- [ ] Document failover procedures

## Phase 10: Post-Deployment

### Documentation

- [ ] Create runbooks for operations team
- [ ] Document alert thresholds and actions
- [ ] Update network configuration docs
- [ ] Create disaster recovery plan
- [ ] Document CloudFunction APIs for integrations

### Training

- [ ] Train admin team on dashboard usage
- [ ] Demonstrate domain management workflows
- [ ] Show audit log review procedures
- [ ] Review monitoring and alerting setup
- [ ] Document escalation procedures

### Handoff

- [ ] Provide all documentation to team
- [ ] Supply access credentials securely
- [ ] Schedule support training session
- [ ] Establish monitoring and alert response processes
- [ ] Get sign-off from stakeholders

## Rollback Plan

If issues occur:

1. [ ] Revert Vercel deployment to previous version
2. [ ] Stop agent: `systemctl stop gcot-agent`
3. [ ] Restore CoreDNS from backup
4. [ ] Point clients back to original DNS
5. [ ] Investigate issue and fix
6. [ ] Redeploy with fixes

## Troubleshooting Checklist

### Dashboard Not Loading

- [ ] Check Vercel deployment status
- [ ] Verify Firebase credentials in env vars
- [ ] Check browser console for errors
- [ ] Clear browser cache and try again

### Agent Not Syncing

- [ ] Verify Firebase config file exists
- [ ] Check Firebase credentials validity
- [ ] Review agent logs: `npm run dev`
- [ ] Verify Firestore connectivity
- [ ] Check \_system/policyManifest document

### DNS Not Working

- [ ] Verify CoreDNS running: `docker ps` or `systemctl status coredns`
- [ ] Test health: `curl http://localhost:8080/health`
- [ ] Check Corefile syntax: `coredns -test`
- [ ] Verify policies.zone file updated
- [ ] Check upstream DNS servers responding

### High Memory Usage

- [ ] Reduce cache size in Corefile
- [ ] Limit number of concurrent connections
- [ ] Check for log file size issues
- [ ] Monitor with `docker stats` or `htop`

## Success Criteria

- [x] Frontend dashboard fully operational
- [x] Firebase Firestore database configured
- [x] Cloud Functions deployed and tested
- [x] DNS Policy Agent running and syncing
- [x] CoreDNS blocking/allowing domains correctly
- [x] Audit logs recording all actions
- [x] Monitoring and metrics visible
- [x] Documentation complete
- [x] Team trained on operations

## Sign-Off

- **Deployment Date**: **\*\***\_\_\_**\*\***
- **Deployed By**: **\*\***\_\_\_**\*\***
- **Verified By**: **\*\***\_\_\_**\*\***
- **Approved By**: **\*\***\_\_\_**\*\***

---

**Estimated Total Time**: 4-6 hours (including testing and troubleshooting)

For support: See GCOT_README.md, FIRESTORE_SETUP.md, and COREDNS_SETUP.md
