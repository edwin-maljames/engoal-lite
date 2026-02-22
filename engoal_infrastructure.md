# Engoal Infrastructure Document

> **App:** Engoal -- Personal Financial Planning
> **Owner:** edwin-maljames (GitHub)
> **Last Updated:** 2026-02-22
> **Classification:** Single-user, single-server deployment on DigitalOcean

---

## Table of Contents

1. [Droplet Specification](#1-droplet-specification)
2. [Server Layout](#2-server-layout)
3. [Nginx Configuration](#3-nginx-configuration)
4. [PostgreSQL Setup](#4-postgresql-setup)
5. [Environment Variables & Secrets Management](#5-environment-variables--secrets-management)
6. [Firewall Configuration](#6-firewall-configuration)
7. [SSH Hardening](#7-ssh-hardening)
8. [Systemd Service Files](#8-systemd-service-files)
9. [Logging & Monitoring](#9-logging--monitoring)
10. [Deployment Runbook](#10-deployment-runbook)
11. [Disaster Recovery](#11-disaster-recovery)

---

## 1. Droplet Specification

### Recommended Droplet

| Attribute       | Value                          |
|-----------------|--------------------------------|
| **Plan**        | Basic (Regular SSD)            |
| **Size**        | `s-1vcpu-2gb` ($12/month)     |
| **vCPUs**       | 1                              |
| **RAM**         | 2 GB                           |
| **Disk**        | 50 GB SSD                      |
| **Transfer**    | 2 TB/month                     |
| **OS**          | Ubuntu 24.04 LTS (Noble)       |
| **Region**      | `nyc1` (New York 1)            |

### Justification

- **1 vCPU / 2 GB RAM** is sufficient for a single-user financial planning app. FastAPI with Uvicorn idles at ~30 MB, Next.js at ~80-120 MB, and PostgreSQL at ~50-100 MB. Total steady-state memory usage stays well under 1 GB, leaving headroom for OS processes, Nginx, and brief load spikes.
- **50 GB SSD** provides ample room for the OS (~5 GB), application code (~500 MB with node_modules), PostgreSQL data (minimal for personal use), logs, and backups.
- **NYC1** is a stable, well-provisioned region. Change to the region closest to your physical location for lowest latency.
- If you later find that Next.js builds or migrations cause memory pressure, upgrade to `s-1vcpu-2gb` -> `s-2vcpu-2gb` ($18/month) in-place via the DigitalOcean console with a brief reboot.

### Provisioning Command (doctl)

```bash
doctl compute droplet create engoal \
  --region nyc1 \
  --size s-1vcpu-2gb \
  --image ubuntu-24-04-x64 \
  --ssh-keys $(doctl compute ssh-key list --format ID --no-header | tr '\n' ',') \
  --tag-name engoal \
  --enable-monitoring \
  --wait
```

> **Note:** `--enable-monitoring` installs the DigitalOcean metrics agent automatically so you get CPU, memory, and disk graphs in the dashboard.

---

## 2. Server Layout

### Directory Structure

```
/opt/engoal/                        # Application root (owned by engoal user)
  backend/                          # FastAPI source code
    .env                            # Backend environment variables
    alembic/                        # Database migrations
    app/                            # Application package
    requirements.txt
    pyproject.toml
  frontend/                         # Next.js source code
    .env.local                      # Frontend environment variables
    .next/                          # Build output
    package.json
  venv/                             # Python virtual environment

/var/log/engoal/                    # Application logs
  backend.log                       # FastAPI stdout/stderr
  frontend.log                      # Next.js stdout/stderr

/var/backups/engoal/                # PostgreSQL backups
  daily/                            # pg_dump files (last 7 days)

/etc/nginx/sites-available/engoal   # Nginx site config
/etc/nginx/sites-enabled/engoal     # Symlink to above

/etc/systemd/system/
  engoal-backend.service            # FastAPI service unit
  engoal-frontend.service           # Next.js service unit
```

### Process Architecture

| Process        | Manager  | Listens On        | Notes                                  |
|---------------|----------|-------------------|----------------------------------------|
| Nginx          | systemd  | `0.0.0.0:80,443` | Reverse proxy, TLS termination         |
| FastAPI        | systemd  | `127.0.0.1:8000`  | Uvicorn with 2 workers                 |
| Next.js        | systemd  | `127.0.0.1:3000`  | `next start` (production server)       |
| PostgreSQL 16  | systemd  | `127.0.0.1:5432`  | Managed by `postgresql.service`        |

**Why systemd over PM2:** PM2 adds an extra runtime dependency and its own process management layer. For a single-server single-user setup, systemd provides reliable process supervision, automatic restart on failure, clean journal logging, and zero additional dependencies. PM2 is unnecessary overhead here.

### Dedicated System User

Create a non-root user to own and run the application:

```bash
sudo useradd --system --shell /usr/sbin/nologin --home-dir /opt/engoal --create-home engoal
```

All application files under `/opt/engoal/` should be owned by `engoal:engoal`. The systemd services run as this user.

---

## 3. Nginx Configuration

### Main Site Configuration

File: `/etc/nginx/sites-available/engoal`

```nginx
# Rate limiting zone: 10 requests/second per IP, burst of 20
limit_req_zone $binary_remote_addr zone=engoal_ratelimit:10m rate=10r/s;

# API-specific rate limiting: 5 requests/second per IP
limit_req_zone $binary_remote_addr zone=engoal_api_ratelimit:10m rate=5r/s;

# Upstream definitions
upstream engoal_backend {
    server 127.0.0.1:8000;
}

upstream engoal_frontend {
    server 127.0.0.1:3000;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name engoal.example.com;

    # Allow ACME challenge for Certbot
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name engoal.example.com;

    # -----------------------------------------------------------
    # SSL/TLS (managed by Certbot)
    # -----------------------------------------------------------
    ssl_certificate     /etc/letsencrypt/live/engoal.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/engoal.example.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/engoal.example.com/chain.pem;

    # Modern TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 1.0.0.1 valid=300s;
    resolver_timeout 5s;

    # -----------------------------------------------------------
    # Security Headers
    # -----------------------------------------------------------
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "0" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;

    # -----------------------------------------------------------
    # Gzip Compression
    # -----------------------------------------------------------
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        application/atom+xml
        application/geo+json
        application/javascript
        application/json
        application/ld+json
        application/manifest+json
        application/rdf+xml
        application/rss+xml
        application/xhtml+xml
        application/xml
        font/eot
        font/otf
        font/ttf
        image/svg+xml
        text/css
        text/javascript
        text/plain
        text/xml;

    # -----------------------------------------------------------
    # General Settings
    # -----------------------------------------------------------
    client_max_body_size 10M;
    server_tokens off;

    # -----------------------------------------------------------
    # API Routes -> FastAPI Backend
    # -----------------------------------------------------------
    location /api/ {
        limit_req zone=engoal_api_ratelimit burst=10 nodelay;
        limit_req_status 429;

        proxy_pass http://engoal_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # API documentation (restrict in production — only allow from your IP)
    location /docs {
        # Uncomment and set your IP to restrict access:
        # allow YOUR_IP_HERE;
        # deny all;

        proxy_pass http://engoal_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /openapi.json {
        proxy_pass http://engoal_backend;
        proxy_set_header Host $host;
    }

    # -----------------------------------------------------------
    # Everything Else -> Next.js Frontend
    # -----------------------------------------------------------
    location / {
        limit_req zone=engoal_ratelimit burst=20 nodelay;
        limit_req_status 429;

        proxy_pass http://engoal_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Next.js static assets (long cache)
    location /_next/static/ {
        proxy_pass http://engoal_frontend;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # -----------------------------------------------------------
    # Block common exploit paths
    # -----------------------------------------------------------
    location ~ /\.(git|env|htaccess|htpasswd) {
        deny all;
        return 404;
    }

    location ~* /(wp-admin|wp-login|xmlrpc\.php|phpmyadmin) {
        deny all;
        return 404;
    }
}
```

### Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/engoal /etc/nginx/sites-enabled/engoal
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### SSL/TLS via Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate (Nginx plugin handles config automatically)
sudo certbot --nginx -d engoal.example.com --non-interactive --agree-tos -m your-email@example.com

# Verify auto-renewal timer is active
sudo systemctl status certbot.timer

# Test renewal dry-run
sudo certbot renew --dry-run
```

Certbot automatically installs a systemd timer that renews certificates before expiry. No cron job needed.

---

## 4. PostgreSQL Setup

### Installation

```bash
# Install PostgreSQL 16 from official APT repo
sudo apt install -y gnupg2 lsb-release
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
sudo apt update
sudo apt install -y postgresql-16
```

### Hardening

Edit `/etc/postgresql/16/main/postgresql.conf`:

```ini
# Bind to localhost only — no remote access
listen_addresses = 'localhost'

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_rotation_size = 50MB
log_min_duration_statement = 500    # Log slow queries (>500ms)
log_statement = 'ddl'              # Log all DDL statements
log_connections = on
log_disconnections = on
log_line_prefix = '%m [%p] %u@%d '

# Resource tuning for 2 GB RAM
shared_buffers = 512MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB
wal_buffers = 16MB

# Security
password_encryption = scram-sha-256
```

Edit `/etc/postgresql/16/main/pg_hba.conf` (replace the default entries):

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   engoal_db       engoal_user                             scram-sha-256
host    engoal_db       engoal_user     127.0.0.1/32            scram-sha-256
host    engoal_db       engoal_user     ::1/128                 scram-sha-256
# Deny everything else
local   all             all                                     reject
host    all             all             0.0.0.0/0               reject
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### Create Database and Least-Privilege User

```bash
sudo -u postgres psql <<'SQL'
-- Create application user (NOT a superuser)
CREATE USER engoal_user WITH
    LOGIN
    PASSWORD 'REPLACE_WITH_STRONG_PASSWORD'
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    CONNECTION LIMIT 10;

-- Create database owned by the app user
CREATE DATABASE engoal_db
    OWNER engoal_user
    ENCODING 'UTF8'
    LC_COLLATE 'en_US.UTF-8'
    LC_CTYPE 'en_US.UTF-8'
    TEMPLATE template0;

-- Connect to the new database and lock down permissions
\c engoal_db

-- Revoke default public access
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO engoal_user;

-- The app user can create tables via Alembic migrations
-- but cannot modify system catalogs or other databases
SQL
```

> **Password generation tip:** `openssl rand -base64 32` generates a strong 32-byte random password.

### Backup Strategy

Daily `pg_dump` via cron, keeping the last 7 days.

Create the backup script at `/opt/engoal/scripts/backup_db.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/engoal/daily"
DB_NAME="engoal_db"
DB_USER="engoal_user"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Dump and compress
pg_dump -U "${DB_USER}" -h 127.0.0.1 "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# Verify the backup is non-empty
if [ ! -s "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file is empty: ${BACKUP_FILE}" >&2
    exit 1
fi

# Remove backups older than retention period
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"
```

Set permissions and install cron job:

```bash
sudo chmod 750 /opt/engoal/scripts/backup_db.sh
sudo chown engoal:engoal /opt/engoal/scripts/backup_db.sh

# Add to root crontab (runs daily at 02:00 UTC)
sudo crontab -l 2>/dev/null | { cat; echo "0 2 * * * /opt/engoal/scripts/backup_db.sh >> /var/log/engoal/backup.log 2>&1"; } | sudo crontab -
```

> **Important:** Store the database password in a `.pgpass` file at `/opt/engoal/.pgpass` so the cron job does not need it inline:
>
> ```
> 127.0.0.1:5432:engoal_db:engoal_user:REPLACE_WITH_STRONG_PASSWORD
> ```
>
> ```bash
> chmod 600 /opt/engoal/.pgpass
> chown engoal:engoal /opt/engoal/.pgpass
> ```
>
> Set `PGPASSFILE=/opt/engoal/.pgpass` in the backup script's environment or the engoal user's profile.

### Connection Pooling

For a single-user app, PostgreSQL's default connection handling is sufficient. However, to prevent connection leaks and enforce limits, configure SQLAlchemy's built-in connection pool in the FastAPI backend:

```python
# In backend/app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(
    "postgresql+psycopg2://engoal_user:PASSWORD@127.0.0.1:5432/engoal_db",
    pool_size=5,          # Maximum persistent connections
    max_overflow=2,       # Extra connections allowed under load
    pool_timeout=30,      # Seconds to wait for a connection from the pool
    pool_recycle=1800,    # Recycle connections every 30 minutes
    pool_pre_ping=True,   # Verify connections are alive before using
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

**PgBouncer is not needed** for this scale. SQLAlchemy's pool handles everything. If you ever scale to multiple backend workers or processes, revisit and install PgBouncer at that point.

---

## 5. Environment Variables & Secrets Management

### Required Environment Variables

#### Backend (`/opt/engoal/backend/.env`)

```bash
# Database
DATABASE_URL=postgresql+psycopg2://engoal_user:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/engoal_db

# Application Security
SECRET_KEY=REPLACE_WITH_64_CHAR_RANDOM_HEX
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"

# CORS
ALLOWED_ORIGINS=https://engoal.example.com

# FastAPI
APP_ENV=production
DEBUG=false
LOG_LEVEL=info

# JWT (if using token-based auth)
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

#### Frontend (`/opt/engoal/frontend/.env.local`)

```bash
# API endpoint (server-side rendering calls this)
NEXT_PUBLIC_API_URL=https://engoal.example.com/api
```

### Storage on the Droplet

Use systemd `EnvironmentFile` directives to load environment variables. This is more secure than sourcing `.env` files because:
- systemd manages file access permissions
- Variables are not visible in `/proc/<pid>/environ` to other non-root users
- The `.env` files are readable only by root and the `engoal` user

```bash
# Secure the .env files
sudo chmod 600 /opt/engoal/backend/.env
sudo chown engoal:engoal /opt/engoal/backend/.env
sudo chmod 600 /opt/engoal/frontend/.env.local
sudo chown engoal:engoal /opt/engoal/frontend/.env.local
```

The systemd service files (see Section 8) reference these with `EnvironmentFile=`.

### GitHub Actions Secrets

Configure these in the repository settings at `Settings > Secrets and variables > Actions`:

| Secret Name          | Value                                | Used For                   |
|---------------------|--------------------------------------|----------------------------|
| `DROPLET_SSH_KEY`    | Private SSH key for deploy user      | SSH into Droplet           |
| `DROPLET_HOST`       | Droplet IP or hostname               | SSH target                 |
| `DROPLET_USER`       | `deploy` (see deployment user below) | SSH username               |
| `DROPLET_SSH_PORT`   | `2222` (or your chosen port)         | SSH port                   |

> **Never store `DATABASE_URL`, `SECRET_KEY`, or other application secrets in GitHub Actions.** Those live only on the Droplet. GitHub Actions only needs SSH access to trigger deployments.

---

## 6. Firewall Configuration

### UFW Setup

```bash
# Reset to defaults (deny incoming, allow outgoing)
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (use your chosen port — 2222 in this doc)
sudo ufw allow 2222/tcp comment "SSH"

# Allow HTTP (for Certbot ACME challenge and redirect to HTTPS)
sudo ufw allow 80/tcp comment "HTTP"

# Allow HTTPS
sudo ufw allow 443/tcp comment "HTTPS"

# Enable the firewall
sudo ufw enable

# Verify rules
sudo ufw status verbose
```

Expected output:

```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
2222/tcp                   ALLOW IN    Anywhere         # SSH
80/tcp                     ALLOW IN    Anywhere         # HTTP
443/tcp                    ALLOW IN    Anywhere         # HTTPS
2222/tcp (v6)              ALLOW IN    Anywhere (v6)    # SSH
80/tcp (v6)                ALLOW IN    Anywhere (v6)    # HTTP
443/tcp (v6)               ALLOW IN    Anywhere (v6)    # HTTPS
```

> **PostgreSQL port 5432 is NOT opened.** It binds to localhost only and is never accessible from the network.

---

## 7. SSH Hardening

### Create a Deploy User

```bash
# Create deploy user with sudo access
sudo adduser deploy --disabled-password --gecos ""
sudo usermod -aG sudo deploy

# Set up SSH key for deploy user
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh

# Add your public key (from Alteeza Lab Mac Mini)
# Copy the output of: cat ~/.ssh/id_ed25519.pub (on the Mac Mini)
echo "ssh-ed25519 AAAA... your-key-here" | sudo tee /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

### Harden SSH Configuration

Edit `/etc/ssh/sshd_config`:

```sshd_config
# Change default port to reduce automated scanning noise
Port 2222

# Protocol
Protocol 2

# Authentication
PermitRootLogin no
PasswordAuthentication no
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

# Restrict to deploy user only
AllowUsers deploy

# Timeouts and limits
LoginGraceTime 30
MaxAuthTries 3
MaxSessions 3
ClientAliveInterval 300
ClientAliveCountMax 2

# Disable unused features
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PermitTunnel no
```

Apply changes:

```bash
sudo sshd -t                  # Test config before restarting
sudo systemctl restart sshd
```

> **Critical:** Test that you can SSH in on the new port from a second terminal BEFORE closing your current session. If you lock yourself out, use the DigitalOcean web console to recover.

### fail2ban for Brute-Force Protection

```bash
sudo apt install fail2ban -y
```

Create `/etc/fail2ban/jail.local`:

```ini
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 3
backend  = systemd

[sshd]
enabled  = true
port     = 2222
filter   = sshd
logpath  = %(sshd_log)s
maxretry = 3
bantime  = 3600
```

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Verify it is running
sudo fail2ban-client status sshd
```

### SSH Config on Alteeza Lab Mac Mini

Add to `~/.ssh/config` on the Mac Mini for easy access:

```
Host engoal
    HostName DROPLET_IP_OR_HOSTNAME
    User deploy
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

Then connect with just: `ssh engoal`

---

## 8. Systemd Service Files

### FastAPI Backend Service

File: `/etc/systemd/system/engoal-backend.service`

```ini
[Unit]
Description=Engoal FastAPI Backend
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=exec
User=engoal
Group=engoal
WorkingDirectory=/opt/engoal/backend
EnvironmentFile=/opt/engoal/backend/.env
ExecStart=/opt/engoal/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info \
    --access-log \
    --proxy-headers \
    --forwarded-allow-ips 127.0.0.1
ExecReload=/bin/kill -HUP $MAINPID

# Restart policy
Restart=always
RestartSec=5
StartLimitBurst=5
StartLimitIntervalSec=60

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/engoal
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictNamespaces=true

# Logging
StandardOutput=append:/var/log/engoal/backend.log
StandardError=append:/var/log/engoal/backend.log

[Install]
WantedBy=multi-user.target
```

### Next.js Frontend Service

File: `/etc/systemd/system/engoal-frontend.service`

```ini
[Unit]
Description=Engoal Next.js Frontend
After=network.target

[Service]
Type=exec
User=engoal
Group=engoal
WorkingDirectory=/opt/engoal/frontend
EnvironmentFile=/opt/engoal/frontend/.env.local
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node /opt/engoal/frontend/node_modules/.bin/next start --port 3000
ExecReload=/bin/kill -HUP $MAINPID

# Restart policy
Restart=always
RestartSec=5
StartLimitBurst=5
StartLimitIntervalSec=60

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/engoal/frontend/.next
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true

# Logging
StandardOutput=append:/var/log/engoal/frontend.log
StandardError=append:/var/log/engoal/frontend.log

[Install]
WantedBy=multi-user.target
```

### Enable and Start Services

```bash
# Create log directory
sudo mkdir -p /var/log/engoal
sudo chown engoal:engoal /var/log/engoal

# Reload systemd, enable, and start
sudo systemctl daemon-reload
sudo systemctl enable engoal-backend engoal-frontend
sudo systemctl start engoal-backend engoal-frontend

# Check status
sudo systemctl status engoal-backend
sudo systemctl status engoal-frontend
```

---

## 9. Logging & Monitoring

### Application Log Locations

| Log Source       | File Path                              |
|-----------------|----------------------------------------|
| FastAPI backend  | `/var/log/engoal/backend.log`          |
| Next.js frontend | `/var/log/engoal/frontend.log`         |
| DB backups       | `/var/log/engoal/backup.log`           |
| Nginx access     | `/var/log/nginx/access.log`            |
| Nginx error      | `/var/log/nginx/error.log`             |
| PostgreSQL       | `/var/log/postgresql/postgresql-*.log`  |
| SSH / auth       | `/var/log/auth.log`                    |

### Log Rotation

Create `/etc/logrotate.d/engoal`:

```
/var/log/engoal/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 engoal engoal
    sharedscripts
    postrotate
        systemctl reload engoal-backend 2>/dev/null || true
        systemctl reload engoal-frontend 2>/dev/null || true
    endscript
}
```

Nginx and PostgreSQL logs are already handled by their own logrotate configs installed by their packages. Verify with:

```bash
ls /etc/logrotate.d/nginx
ls /etc/logrotate.d/postgresql-common
```

### Structured JSON Logging from FastAPI

Configure the FastAPI backend to output structured JSON logs for machine-readability. In `backend/app/logging_config.py`:

```python
import logging
import sys
import json
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Outputs log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        # Include any extra fields passed via `extra={}`
        for key in ("request_id", "user_id", "endpoint", "method", "status_code", "duration_ms"):
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)
        return json.dumps(log_entry)


def setup_logging(log_level: str = "INFO") -> None:
    """Configure root logger with JSON output."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    root_logger.handlers.clear()
    root_logger.addHandler(handler)

    # Quiet down noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
```

Call `setup_logging()` in your FastAPI `main.py` at startup:

```python
from app.logging_config import setup_logging

setup_logging(log_level=os.getenv("LOG_LEVEL", "INFO"))
```

### DigitalOcean Monitoring Alerts

Set up the following alerts in the DigitalOcean dashboard under **Monitoring > Alerts**:

| Alert                | Threshold              | Duration  | Action        |
|---------------------|------------------------|-----------|---------------|
| CPU usage            | > 80%                 | 5 minutes | Email alert   |
| Memory usage         | > 85%                 | 5 minutes | Email alert   |
| Disk usage           | > 80%                 | 5 minutes | Email alert   |
| Disk read IOPS       | > 10,000              | 5 minutes | Email alert   |

These can also be created via doctl:

```bash
# Example: CPU alert
doctl monitoring alert create \
  --type v1/insights/droplet/cpu \
  --compare GreaterThan \
  --value 80 \
  --window 5m \
  --entities $(doctl compute droplet list --format ID --no-header) \
  --emails your-email@example.com
```

### Quick Health Check Script

Save as `/opt/engoal/scripts/health_check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Engoal Health Check ==="
echo "Date: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""

# Service status
for svc in engoal-backend engoal-frontend nginx postgresql; do
    status=$(systemctl is-active "${svc}" 2>/dev/null || echo "inactive")
    printf "%-25s %s\n" "${svc}" "${status}"
done

echo ""

# HTTP checks
backend_status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health 2>/dev/null || echo "000")
frontend_status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 2>/dev/null || echo "000")
echo "Backend /api/health:  HTTP ${backend_status}"
echo "Frontend /:           HTTP ${frontend_status}"

echo ""

# Disk usage
echo "Disk usage:"
df -h / | tail -1 | awk '{print "  Used: "$3"  Free: "$4"  Pct: "$5}'

echo ""

# Memory
echo "Memory:"
free -h | grep Mem | awk '{print "  Total: "$2"  Used: "$3"  Free: "$4}'

echo ""

# DB connection test
if sudo -u engoal psql -h 127.0.0.1 -U engoal_user -d engoal_db -c "SELECT 1;" > /dev/null 2>&1; then
    echo "PostgreSQL: connected OK"
else
    echo "PostgreSQL: CONNECTION FAILED"
fi
```

---

## 10. Deployment Runbook

### Phase 1: Initial Droplet Provisioning (One-Time Setup)

Run these commands by SSHing into the Droplet as root immediately after creation.

#### Step 1: System Update and Base Packages

```bash
apt update && apt upgrade -y
apt install -y \
    build-essential \
    curl \
    git \
    gnupg2 \
    lsb-release \
    nginx \
    python3.12 \
    python3.12-venv \
    python3-pip \
    ufw \
    fail2ban \
    logrotate \
    certbot \
    python3-certbot-nginx \
    unattended-upgrades
```

#### Step 2: Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version   # Should print v20.x.x
```

#### Step 3: Install PostgreSQL 16

(See Section 4 for full commands.)

#### Step 4: Create System Users

```bash
# Application user
useradd --system --shell /usr/sbin/nologin --home-dir /opt/engoal --create-home engoal

# Deploy user (for SSH access)
adduser deploy --disabled-password --gecos ""
usermod -aG sudo deploy
# Set up SSH keys for deploy (see Section 7)
```

#### Step 5: Harden SSH

(See Section 7. Test access on new port before closing root session.)

#### Step 6: Configure Firewall

(See Section 6.)

#### Step 7: Set Up Directory Structure

```bash
mkdir -p /opt/engoal/{backend,frontend,scripts}
mkdir -p /opt/engoal/venv
mkdir -p /var/log/engoal
mkdir -p /var/backups/engoal/daily
chown -R engoal:engoal /opt/engoal /var/log/engoal /var/backups/engoal
```

#### Step 8: Clone the Repository

```bash
# As deploy user (who has the SSH key for GitHub)
sudo -u deploy bash -c '
    cd /tmp
    git clone git@github.com:edwin-maljames/engoal.git
    cp -r engoal/backend/* /opt/engoal/backend/
    cp -r engoal/frontend/* /opt/engoal/frontend/
    rm -rf /tmp/engoal
'
sudo chown -R engoal:engoal /opt/engoal/backend /opt/engoal/frontend
```

Alternatively, grant the `deploy` user a deploy key scoped to the repository.

#### Step 9: Install Application Dependencies

```bash
# Backend
sudo -u engoal python3.12 -m venv /opt/engoal/venv
sudo -u engoal /opt/engoal/venv/bin/pip install --upgrade pip
sudo -u engoal /opt/engoal/venv/bin/pip install -r /opt/engoal/backend/requirements.txt

# Frontend
cd /opt/engoal/frontend
sudo -u engoal npm ci --production=false   # Need devDeps for build
sudo -u engoal npm run build
```

#### Step 10: Configure Environment Variables

Create `/opt/engoal/backend/.env` and `/opt/engoal/frontend/.env.local` with values from Section 5. Set permissions:

```bash
chmod 600 /opt/engoal/backend/.env /opt/engoal/frontend/.env.local
chown engoal:engoal /opt/engoal/backend/.env /opt/engoal/frontend/.env.local
```

#### Step 11: Run Database Migrations

```bash
sudo -u engoal bash -c '
    source /opt/engoal/venv/bin/activate
    cd /opt/engoal/backend
    export $(grep -v "^#" .env | xargs)
    alembic upgrade head
'
```

#### Step 12: Install Systemd Services and Start

```bash
# Copy service files (see Section 8)
systemctl daemon-reload
systemctl enable engoal-backend engoal-frontend
systemctl start engoal-backend engoal-frontend
```

#### Step 13: Configure Nginx and SSL

```bash
# Copy Nginx config (see Section 3)
ln -s /etc/nginx/sites-available/engoal /etc/nginx/sites-enabled/engoal
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Get SSL cert (ensure DNS points to this Droplet first)
certbot --nginx -d engoal.example.com --non-interactive --agree-tos -m your-email@example.com
```

#### Step 14: Smoke Test

```bash
# From the Droplet
curl -I https://engoal.example.com
curl -I https://engoal.example.com/api/health

# From the Mac Mini
curl -I https://engoal.example.com
```

Expected: HTTP 200 for both endpoints, valid TLS certificate, security headers present.

#### Step 15: Set Up Backups

(See Section 4 for backup script and cron job.)

#### Step 16: Enable Automatic Security Updates

```bash
dpkg-reconfigure -plow unattended-upgrades
# Select "Yes" to automatically install security updates
```

---

### Phase 2: Ongoing Deployments via GitHub Actions

File: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

concurrency:
  group: production-deploy
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - name: Install backend dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio httpx

      - name: Run backend tests
        env:
          DATABASE_URL: postgresql+psycopg2://test_user:test_pass@localhost:5432/test_db
          SECRET_KEY: test-secret-key-not-for-production
          ALLOWED_ORIGINS: http://localhost:3000
          APP_ENV: test
        run: |
          cd backend
          pytest -v

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install frontend dependencies and test
        run: |
          cd frontend
          npm ci
          npm run lint
          npm test -- --passWithNoTests

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Droplet
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DROPLET_HOST }}
          username: ${{ secrets.DROPLET_USER }}
          key: ${{ secrets.DROPLET_SSH_KEY }}
          port: ${{ secrets.DROPLET_SSH_PORT }}
          script_stop: true
          script: |
            set -euo pipefail

            APP_DIR="/opt/engoal"
            REPO_URL="git@github.com:edwin-maljames/engoal.git"

            # Pull latest code to a staging area
            cd /tmp
            rm -rf engoal-deploy
            git clone --depth 1 --branch main "${REPO_URL}" engoal-deploy

            # --- Backend deployment ---
            sudo rsync -a --delete \
              --exclude='.env' \
              --exclude='__pycache__' \
              --exclude='.pytest_cache' \
              /tmp/engoal-deploy/backend/ "${APP_DIR}/backend/"

            sudo chown -R engoal:engoal "${APP_DIR}/backend"

            sudo -u engoal "${APP_DIR}/venv/bin/pip" install -q -r "${APP_DIR}/backend/requirements.txt"

            # Run migrations
            sudo -u engoal bash -c "
              source ${APP_DIR}/venv/bin/activate
              cd ${APP_DIR}/backend
              export \$(grep -v '^#' .env | xargs)
              alembic upgrade head
            "

            # --- Frontend deployment ---
            sudo rsync -a --delete \
              --exclude='.env.local' \
              --exclude='node_modules' \
              --exclude='.next' \
              /tmp/engoal-deploy/frontend/ "${APP_DIR}/frontend/"

            sudo chown -R engoal:engoal "${APP_DIR}/frontend"

            cd "${APP_DIR}/frontend"
            sudo -u engoal npm ci --production=false
            sudo -u engoal npm run build

            # --- Restart services (rolling: frontend first, then backend) ---
            sudo systemctl restart engoal-frontend
            sleep 3
            sudo systemctl restart engoal-backend
            sleep 3

            # --- Verify services are running ---
            for svc in engoal-backend engoal-frontend; do
              if ! systemctl is-active --quiet "${svc}"; then
                echo "ERROR: ${svc} failed to start after deploy"
                sudo journalctl -u "${svc}" --no-pager -n 20
                exit 1
              fi
            done

            # --- Health check ---
            for i in 1 2 3; do
              if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
                echo "Backend health check passed"
                break
              fi
              if [ "$i" -eq 3 ]; then
                echo "ERROR: Backend health check failed after 3 attempts"
                exit 1
              fi
              sleep 2
            done

            # Cleanup
            rm -rf /tmp/engoal-deploy

            echo "Deployment completed successfully at $(date -u)"
```

### Zero-Downtime Considerations

For a single-user personal app, the 2-3 second restart gap during deployment is acceptable. If you want true zero-downtime in the future:

1. Run two Uvicorn instances on different ports behind Nginx upstream with health checks.
2. Deploy to the inactive instance, health-check it, then swap the Nginx upstream.
3. This is overkill for personal use but documented here for completeness.

---

## 11. Disaster Recovery

### Restoring from a PostgreSQL Backup

If you need to restore the database from a backup:

```bash
# 1. Stop the application to prevent writes during restore
sudo systemctl stop engoal-backend

# 2. List available backups
ls -lah /var/backups/engoal/daily/

# 3. Drop and recreate the database
sudo -u postgres psql <<'SQL'
-- Terminate any remaining connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = 'engoal_db' AND pid <> pg_backend_pid();

DROP DATABASE engoal_db;
CREATE DATABASE engoal_db OWNER engoal_user ENCODING 'UTF8' TEMPLATE template0;
SQL

# 4. Restore from the backup file
gunzip -c /var/backups/engoal/daily/engoal_db_2026-02-22_020000.sql.gz | \
    sudo -u engoal psql -h 127.0.0.1 -U engoal_user -d engoal_db

# 5. Verify the restore
sudo -u engoal psql -h 127.0.0.1 -U engoal_user -d engoal_db -c "\dt"

# 6. Restart the application
sudo systemctl start engoal-backend

# 7. Run a health check
curl -s http://127.0.0.1:8000/api/health
```

### Full Droplet Rebuild from Scratch

If the Droplet is lost entirely (catastrophic failure, accidental deletion), follow this procedure to rebuild:

#### Prerequisites

- GitHub repository is intact (source of truth for all code)
- A recent PostgreSQL backup exists (either in DigitalOcean Spaces, a local copy, or the old Droplet's snapshots)
- SSH keys and secrets are documented in a secure password manager

#### Rebuild Steps

```
1. Provision a new Droplet             (Section 1 — doctl command)
2. Run full initial setup              (Section 10, Phase 1, Steps 1-8)
3. Configure SSH and firewall          (Sections 6, 7)
4. Install PostgreSQL                  (Section 4)
5. Restore database from backup        (This section, above)
6. Configure environment variables     (Section 5)
7. Install app dependencies            (Section 10, Phase 1, Step 9)
8. Run migrations (if needed after     (Section 10, Phase 1, Step 11)
   restore — usually not needed
   if restoring a full dump)
9. Install and start systemd services  (Section 8)
10. Configure Nginx                    (Section 3)
11. Update DNS A record to new IP      (DNS provider dashboard)
12. Obtain new SSL certificate         (Section 3 — Certbot)
13. Update GitHub Actions secrets      (Section 5 — new DROPLET_HOST)
    with new Droplet IP
14. Run smoke tests                    (Section 10, Phase 1, Step 14)
15. Set up backup cron job             (Section 4)
```

**Estimated rebuild time:** 45-60 minutes for a human operator following this document, or 20-30 minutes for an automated script.

### Off-Site Backup Recommendation

For true disaster recovery, copy database backups off the Droplet. Options for a personal-use setup:

**Option A: DigitalOcean Spaces (recommended)**

Add to the backup script:

```bash
# After the local pg_dump, upload to Spaces
s3cmd put "${BACKUP_FILE}" s3://engoal-backups/daily/

# Or use DigitalOcean's CLI
doctl storage object put engoal-backups "${BACKUP_FILE}" --region nyc1
```

Cost: ~$5/month for 250 GB of Spaces storage.

**Option B: SCP to Alteeza Lab Mac Mini**

Add a cron job on the Mac Mini that pulls the latest backup:

```bash
# On Mac Mini crontab (runs daily at 03:00)
0 3 * * * scp -P 2222 deploy@engoal:/var/backups/engoal/daily/$(date +\%Y-\%m-\%d)*.sql.gz ~/backups/engoal/
```

**Option C: DigitalOcean Droplet Snapshots**

Enable weekly automated snapshots in the DigitalOcean dashboard. Cost: 20% of the Droplet price ($2.40/month). This captures the entire disk state but is slower to restore from than a database dump.

---

## Appendix: Quick Reference Commands

```bash
# --- Service Management ---
sudo systemctl status engoal-backend     # Check backend status
sudo systemctl status engoal-frontend    # Check frontend status
sudo systemctl restart engoal-backend    # Restart backend
sudo systemctl restart engoal-frontend   # Restart frontend
sudo journalctl -u engoal-backend -f    # Tail backend logs (systemd journal)
sudo journalctl -u engoal-frontend -f   # Tail frontend logs

# --- Nginx ---
sudo nginx -t                            # Test config
sudo systemctl reload nginx              # Apply config changes
sudo tail -f /var/log/nginx/access.log   # Tail access log

# --- PostgreSQL ---
sudo -u postgres psql                    # Connect as postgres superuser
sudo -u engoal psql -h 127.0.0.1 -U engoal_user -d engoal_db  # Connect as app user

# --- SSL ---
sudo certbot certificates                # List certificates and expiry
sudo certbot renew --dry-run             # Test renewal

# --- Firewall ---
sudo ufw status verbose                  # Show rules
sudo fail2ban-client status sshd         # Show banned IPs

# --- Backups ---
ls -lah /var/backups/engoal/daily/       # List backups
/opt/engoal/scripts/backup_db.sh         # Run manual backup

# --- Health ---
/opt/engoal/scripts/health_check.sh      # Full health check
```
