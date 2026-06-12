# GCOT Web GUI Installation (Production)

This document describes the manual production installation of the GCOT Web GUI on a dedicated Ubuntu KVM VM for domain `atrava-domain-defense.cisoasaservice.io` (public IP `115.147.169.197`).

Prerequisites (on the web VM)

- Ubuntu 22.04 LTS
- Public IP: 115.147.169.197 assigned and DNS A record for `atrava-domain-defense.cisoasaservice.io`
- Port 80/443 allowed through the VM firewall

Manual installation steps

1. Install prerequisites:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

2. Create the application user and directory:

```bash
sudo useradd -m -s /bin/bash gcot || true
sudo mkdir -p /opt/gcot
sudo chown gcot:gcot /opt/gcot
```

3. Clone the repository:

```bash
sudo -u gcot bash -lc '
cd /opt/gcot
git clone https://github.com/your-org/ATRAVA-Domain-Defense.git .
'
```

4. Create the production environment file:

```bash
sudo -u gcot bash -lc '
cat > /opt/gcot/.env.local <<EOF
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://atrava-domain-defense.cisoasaservice.io

NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...paste the full private key here...\n-----END PRIVATE KEY-----\n"

AUTH_SECRET=replace_with_strong_random_secret
EOF
chmod 600 /opt/gcot/.env.local
'
```

5. Install dependencies and build the app:

```bash
cd /opt/gcot
sudo -u gcot npm install --production
sudo -u gcot npm run build
```

6. Install and start the systemd service:

```bash
sudo cp /opt/gcot/deployment/gcot-web.service /etc/systemd/system/gcot-web.service
sudo systemctl daemon-reload
sudo systemctl enable --now gcot-web
sudo systemctl status gcot-web
```

7. Install and configure Nginx:

```bash
sudo cp /opt/gcot/deployment/nginx-gcot.conf /etc/nginx/sites-available/gcot
sudo ln -sf /etc/nginx/sites-available/gcot /etc/nginx/sites-enabled/gcot
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot
sudo nginx -t
sudo systemctl reload nginx
```

8. Obtain TLS certificate:

```bash
sudo certbot --nginx -d atrava-domain-defense.cisoasaservice.io
sudo certbot renew --dry-run
```

The repository Nginx config is an HTTP bootstrap proxy. Certbot updates it with HTTPS settings after the certificate is issued.

Important manual steps

- Edit `/opt/gcot/.env.local` and set production secrets (Firebase client keys, Firebase Admin service account keys, `AUTH_SECRET`, and `NEXT_PUBLIC_APP_URL=https://atrava-domain-defense.cisoasaservice.io`).
- Ensure `/opt/gcot/.env.local` is owned by `gcot` and protected: `sudo chown gcot:gcot /opt/gcot/.env.local && sudo chmod 600 /opt/gcot/.env.local`.
- Do not expose port 3000 to the public; Nginx proxies to it on `localhost`.

Rollback

- To stop the site:

```bash
sudo systemctl stop gcot-web
sudo systemctl disable gcot-web
sudo rm /etc/nginx/sites-enabled/gcot
sudo systemctl reload nginx
```

Contact

- If anything fails, check `sudo journalctl -u gcot-web -f` and `sudo journalctl -u nginx -f` for logs.
