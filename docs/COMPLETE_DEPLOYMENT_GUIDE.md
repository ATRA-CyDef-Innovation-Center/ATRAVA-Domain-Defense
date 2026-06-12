# GCOT Complete Deployment Guide (Ubuntu KVM VMs)

**Last Updated:** 2026-06-06  
**Environment:** ATRAVA Domain Defense (GCOT)  
**Architecture:**

- **GCOT Node VM:** 115.147.169.196 (Unbound + CoreDNS + GCOT Agent in Docker)
- **Web GUI VM:** 115.147.169.197 (Next.js dashboard via Nginx + TLS)
- **Domain:** atrava-domain-defense.cisoasaservice.io

---

## Part 1: GCOT Node VM (115.147.169.196)

### Prerequisites

- Ubuntu 22.04 LTS or 24.04 LTS
- 2+ vCPU, 4GB RAM, 20GB disk
- Open ports: 53 (UDP/TCP), 80 (TCP for blocked HTTP redirect), 5053 (UDP/TCP), 8080 (TCP), 8081 (TCP explicit proxy)
- Internet access to pull Docker images and reach Firebase

### Step 1: Install Docker & Docker Compose

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Docker
sudo apt install -y ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add current user to docker group (optional, for non-root docker commands)
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2: Clone Repository

```bash
# Clone GCOT repo
cd /opt
sudo git clone https://github.com/your-org/ATRAVA-Domain-Defense.git gcot
cd gcot

# Change ownership to current user (optional)
sudo chown -R $USER:$USER .
```

### Step 3: Configure Firebase Credentials for the Agent

```bash
# Copy the example env file
cp agent/.env.example agent/.env

# Edit with your Firebase credentials (use nano, vim, or your editor)
nano agent/.env
```

**Edit `agent/.env` with these values:**

```bash
NODE_ID=gcot-node-01
NODE_NAME="GCOT Primary Node"
NODE_IP=115.147.169.196

FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...paste the full private key here...
-----END PRIVATE KEY-----"

COREDNS_CONF_PATH=/var/lib/coredns/Corefile
SYNC_INTERVAL=60000
HEALTH_CHECK_INTERVAL=120000
```

**Note:** To get Firebase credentials:

1. Go to Firebase Console → Settings → Service Accounts
2. Click "Generate New Private Key"
3. Copy the JSON content and extract `project_id`, `client_email`, and `private_key`

### Step 4: Build and Start the GCOT Node

```bash
# From /opt/gcot/deployment
cd deployment

# Build the Docker image (includes Unbound, CoreDNS, and the GCOT agent)
docker compose up -d --build

# Verify services are running
docker compose ps

# View logs (check for errors)
docker compose logs -f gcot-node
```

> If the container fails to start with `address already in use` on port 53, another DNS service is already bound to that port on the host.
>
> Check what is using port 53:
>
> ```bash
> sudo ss -tulpn | grep ':53'
> ```
>
> Common blockers on Ubuntu are `systemd-resolved`, `bind9`, or another DNS server. Stop the conflicting service before retrying:
>
> ```bash
> sudo systemctl stop systemd-resolved
> sudo systemctl disable systemd-resolved
> sudo systemctl stop bind9
> ```
>
> If DNS resolution fails after stopping `systemd-resolved`, update `/etc/resolv.conf` to use a public resolver while building the container:
>
> ```bash
> echo -e "nameserver 1.1.1.1\nnameserver 8.8.8.8" | sudo tee /etc/resolv.conf
> ```
>
> Then retry:
>
> ```bash
> docker compose up -d --build
> ```

Expected output in logs:

```
[v0] Initializing Firebase...
[v0] Firebase initialized successfully
[v0] Node registered: gcot-node-01
[v0] Starting initial policy sync...
[v0] Agent started successfully
```

### Step 5: Verify GCOT Node

```bash
# Test DNS on the node (internal only, port 53)
dig @127.0.0.1 google.com

# Test CoreDNS health
curl http://127.0.0.1:8080/health

# View Docker logs
docker compose logs gcot-node
```

---

## Part 2: Web GUI VM (115.147.169.197)

### Prerequisites

- Ubuntu 22.04 LTS or 24.04 LTS
- 2+ vCPU, 4GB RAM, 20GB disk
- Public IP: 115.147.169.197 assigned
- DNS A record for `atrava-domain-defense.cisoasaservice.io` pointing to this VM
- Open ports: 80 (HTTP), 443 (HTTPS)
- Internet access to install packages and pull from npm

### Step 1: Install System Packages

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential git curl nginx certbot python3-certbot-nginx
```

### Step 2: Create Application User and Directory

```bash
# Create gcot user
sudo useradd -m -s /bin/bash gcot

# Create /opt/gcot directory
sudo mkdir -p /opt/gcot
sudo chown gcot:gcot /opt/gcot
```

### Step 3: Clone Repository

```bash
# Switch to gcot user and clone
sudo -u gcot bash << 'EOF'
cd /opt/gcot
git clone https://github.com//ATRAVA-Domain-Defense.git .
EOF
```

### Step 4: Configure Environment

```bash
# Create .env.local for the Next.js app
sudo -u gcot bash << 'EOF'
cat > /opt/gcot/.env.local << 'ENDENV'
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://atrava-domain-defense.cisoasaservice.io

# ATRAVA Domain Defense frontend Firebase web config

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Server-side Firebase Admin service account credentials.
# Keep the private key on one physical line. Single quotes preserve \n when
# systemd loads this file through EnvironmentFile.
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'


# Auth Secret (generate: `openssl rand -base64 32`)
AUTH_SECRET=
ENDENV
chmod 600 /opt/gcot/.env.local
EOF
```

Use the service account JSON from Firebase Console -> Project settings -> Service accounts -> Generate new private key:

- `FIREBASE_ADMIN_PROJECT_ID` = `project_id`
- `FIREBASE_ADMIN_CLIENT_EMAIL` = `client_email`
- `FIREBASE_ADMIN_PRIVATE_KEY` = `private_key`

For the Web GUI systemd service, the Admin private key must stay on one line and should be single-quoted as shown above. After `sudo systemctl restart gcot-web`, verify the running process still has escaped newlines:

```bash
pid=$(systemctl show -p MainPID --value gcot-web)
sudo bash -c 'tr "\0" "\n" < "/proc/$1/environ"' _ "$pid" | awk -F= '/^FIREBASE_ADMIN_PRIVATE_KEY=/ {
  v=$0
  sub(/^[^=]*=/,"",v)
  print "hasBegin=" (v ~ /BEGIN PRIVATE KEY/) " hasEnd=" (v ~ /END PRIVATE KEY/) " hasEscapedNewline=" (v ~ /\\n/)
}'
```

### Step 5: Build the Next.js Application

```bash
# Install dependencies and build
cd /opt/gcot
sudo chown -R gcot:gcot /opt/gcot
sudo chmod 600 /opt/gcot/.env.local
sudo -u gcot npm install --omit=dev
sudo -u gcot npm run build
sudo systemctl restart gcot-web

# Verify build succeeded
ls -la /opt/gcot/.next
```

### Step 6: Create Systemd Service

```bash
# Copy the service file from deployment directory
sudo cp /opt/gcot/deployment/gcot-web.service /etc/systemd/system/gcot-web.service

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable gcot-web
sudo systemctl start gcot-web

# Verify it's running
sudo systemctl status gcot-web
sudo journalctl -u gcot-web -f
```

Expected status:

```
gcot-web.service - GCOT Next.js Web (Production)
     Loaded: loaded (/etc/systemd/system/gcot-web.service; enabled; vendor preset: enabled)
     Active: active (running) since ...
```

### Step 7: Configure Nginx

```bash
# Copy the nginx site config
sudo cp /opt/gcot/deployment/nginx-gcot.conf /etc/nginx/sites-available/gcot

# Enable the site
sudo ln -sf /etc/nginx/sites-available/gcot /etc/nginx/sites-enabled/gcot

# Create certbot challenge directory
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Verify nginx is running
sudo systemctl status nginx
```

### Step 8: Obtain TLS Certificate with Certbot

```bash
# Run Certbot to obtain cert for your domain
sudo certbot --nginx -d atrava-domain-defense.cisoasaservice.io

# Test certificate renewal (dry-run)
sudo certbot renew --dry-run

# Check certificate status
sudo certbot certificates
```

**Note:** Certbot will update the Nginx config automatically to use the certificate.

### Step 9: Verify Web GUI

```bash
# Check if the web service is running on localhost:3000
curl http://127.0.0.1:3000/health 2>/dev/null || echo "Health endpoint may not be available"

# Check nginx is proxying correctly
curl -I https://atrava-domain-defense.cisoasaservice.io 2>/dev/null || echo "Testing via domain (check DNS)"

# Check SSL/TLS
openssl s_client -connect atrava-domain-defense.cisoasaservice.io:443 </dev/null 2>/dev/null | grep -A 2 "subject="

# View web service logs
sudo journalctl -u gcot-web -f
```

---

## Part 4: Verification Checklist

### GCOT Node (115.147.169.196)

- [ ] Docker and compose running
- [ ] Container `gcot-node` is running
- [ ] Firebase credentials are valid (check logs)
- [ ] DNS queries work: `dig @127.0.0.1 google.com`
- [ ] CoreDNS health: `curl http://127.0.0.1:8080/health`

Example verification commands:

```bash
cd /opt/gcot/deployment
docker compose ps
docker compose logs gcot-node | tail -20
curl http://127.0.0.1:8080/health
```

### Web GUI (115.147.169.197)

- [ ] Next.js service running: `sudo systemctl status gcot-web`
- [ ] Nginx proxying correctly
- [ ] TLS certificate valid and auto-renews
- [ ] Web GUI accessible at `https://atrava-domain-defense.cisoasaservice.io`
- [ ] `.env.local` is protected (chmod 600)

Example verification commands:

```bash
sudo systemctl status gcot-web nginx
sudo journalctl -u gcot-web -f
curl https://atrava-domain-defense.cisoasaservice.io --insecure 2>/dev/null | head -20
sudo certbot certificates
```

---

## Part 5: Maintenance & Troubleshooting

### Restarting Services

**GCOT Node:**

```bash
cd /opt/gcot/deployment
docker compose restart gcot-node
# or full rebuild
docker compose down && docker compose up -d --build
```

**Web GUI:**

```bash
sudo systemctl restart gcot-web
# Check logs
sudo journalctl -u gcot-web -f
```

### Updating the Application

**GCOT Node:**

```bash
cd /opt/gcot
git pull origin main
cd deployment
docker compose down
docker compose up -d --build
```

**Web GUI:**

```bash
cd /opt/gcot
sudo -u gcot bash << 'EOF'
git pull origin main
npm install --production
npm run build
EOF
sudo systemctl restart gcot-web
```

### Common Issues

**Issue:** Agent fails to connect to Firebase

- Check Firebase credentials in `agent/.env`
- Verify network connectivity: `curl -I https://firestore.googleapis.com`
- Check service account has Firestore access permissions

**Issue:** Web GUI shows 502 error

- Check if Next.js is running: `sudo systemctl status gcot-web`
- Check logs: `sudo journalctl -u gcot-web -f`
- Verify `.env.local` has correct Firebase keys

**Issue:** TLS certificate not working

- Ensure DNS A record points to 115.147.169.197
- Verify ports 80/443 are open: `sudo iptables -L` or check cloud firewall
- Renew cert: `sudo certbot renew --force-renewal`

**Issue:** CoreDNS not blocking domains

- Check policies are syncing in GCOT dashboard
- Verify zone file exists: `ls -la /var/lib/coredns/policies.zone` (if using Docker volumes)
- Check CoreDNS logs: `docker compose logs gcot-node | grep -i coredns`

### Logs Reference

```bash
# GCOT Node
docker compose logs gcot-node -f       # Main logs
docker compose logs gcot-node --tail 50  # Last 50 lines

# Web GUI
sudo journalctl -u gcot-web -f
sudo journalctl -u nginx -f

# System
sudo dmesg -T | tail -20
```

---

## Part 6: Security Hardening (Post-Deployment)

### Firewall Configuration

**GCOT Node (115.147.169.196):**

```bash
# Allow only necessary ports
sudo ufw default deny incoming
sudo ufw allow 53/udp    # DNS (clients)
sudo ufw allow 53/tcp    # DNS (TCP fallback)
sudo ufw allow 80/tcp    # Block-page HTTP redirect for blocked domains
sudo ufw allow 5053/udp  # CoreDNS (internal only - restrict to internal network)
sudo ufw allow 5053/tcp
sudo ufw allow 8080/tcp  # CoreDNS health (restrict to monitoring host)
sudo ufw allow 8081/tcp  # Explicit HTTP/HTTPS proxy (restrict to client networks)
sudo ufw enable
```

**Web GUI (115.147.169.197):**

```bash
sudo ufw default deny incoming
sudo ufw allow 80/tcp    # HTTP (Certbot renewal)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### File Permissions

```bash
# GCOT Node
chmod 600 /opt/gcot/agent/.env
sudo chown root:root /etc/systemd/system/gcot-web.service

# Web GUI
chmod 600 /opt/gcot/.env.local
sudo chown root:root /etc/systemd/system/gcot-web.service
```

### Regular Backups

```bash
# Backup GCOT node config (on GCOT node host)
sudo tar -czf /backup/gcot-config-$(date +%Y%m%d).tar.gz /opt/gcot/{agent/.env,coredns/}

# Backup web GUI env (on web GUI host)
sudo tar -czf /backup/web-env-$(date +%Y%m%d).tar.gz /opt/gcot/.env.local
```

---

## Summary

| Component           | Host/IP         | Port                             | Status                       |
| ------------------- | --------------- | -------------------------------- | ---------------------------- |
| GCOT Node (Docker)  | 115.147.169.196 | 53, 80, 5053, 8080, 8081         | Running via `docker compose` |
| Web GUI (Next.js)   | 115.147.169.197 | 3000 (localhost), 80/443 (Nginx) | Running via `systemd`        |
| Nginx Reverse Proxy | 115.147.169.197 | 80 → 443                         | Running                      |

---

## Next Steps

1. **Add initial domain policies** via the GCOT dashboard (atrava-domain-defense.cisoasaservice.io)
2. **Configure firewall rules** to restrict DNS access to authorized networks
3. **Enable DNS forwarding** on client networks to use 115.147.169.196:53
4. **Test DNS blocking** from a client: `dig @115.147.169.196 <blocked-domain>`

---

**Support & Logs:** For debugging, check service logs using commands in Part 5 above.
