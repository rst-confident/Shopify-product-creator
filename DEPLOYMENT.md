# Deployment Guide - Shopify Product Import App

This guide explains how to deploy the Shopify Product Import App to your Google Cloud VM using Docker.

## Architecture Overview

The app runs in Docker containers on a Google Cloud VM, completely isolated from other services (like n8n):

- **Application Directory**: `/home/ubuntu/shopify-product-import`
- **Application Port**: `3001` (external), `3000` (internal)
- **Database Port**: `5433` (external), `5432` (internal in container)
- **Containers**:
  - `shopify-import-app`: Node.js application
  - `shopify-import-db`: PostgreSQL 15 database
- **Isolation**: Separate network, ports, and directory from n8n

## Prerequisites

### VM Information
✅ Your VM already has:
- Ubuntu 24.04
- Docker and docker-compose installed
- SSH access configured
- External IP: `34.51.239.48`
- Domain: `produktimport.wemarket.dk`

### Required GitHub Secrets

Configure these secrets in your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `GCP_HOST` | VM external IP | `34.51.239.48` |
| `GCP_USER` | SSH username | `ubuntu` |
| `GCP_SSH_PRIVATE_KEY` | Private SSH key for auth | `-----BEGIN RSA PRIVATE KEY-----...` |

## Initial Setup on VM

### Step 1: SSH into the VM

```bash
ssh ubuntu@34.51.239.48
```

### Step 2: Create App Directory (Separate from n8n)

```bash
# Create isolated directory for this app
mkdir -p /home/ubuntu/shopify-product-import
cd /home/ubuntu/shopify-product-import

# Note: n8n is in /home/ubuntu/n8n-production (don't modify that)
```

### Step 3: Clone Repository

```bash
# Clone the repository
git clone https://github.com/rst-confident/Shopify-product-creator.git .

# Checkout the deployment branch
git checkout claude/shopify-product-import-mvp-011CUwJS7CQA4qp5h11AL2F3
```

### Step 4: Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit environment file
nano .env
```

Configure all required variables:

```bash
# Shopify App Configuration
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
SHOPIFY_SCOPES=read_products,write_products,read_inventory,write_inventory
SHOPIFY_APP_URL=https://produktimport.wemarket.dk
HOST=https://produktimport.wemarket.dk

# Database Configuration (for Docker)
POSTGRES_DB=shopify_import
POSTGRES_USER=shopify_user
POSTGRES_PASSWORD=CHANGE_THIS_TO_SECURE_PASSWORD

# Security (IMPORTANT: Generate a secure random string of 32+ characters)
SESSION_SECRET=GENERATE_SECURE_RANDOM_STRING_MIN_32_CHARS

# OpenRouter AI Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
DEFAULT_AI_MODEL=anthropic/claude-3.5-sonnet

# Application Settings
NODE_ENV=production
APP_PORT=3001
LOG_LEVEL=info
```

**Generate secure secrets:**

```bash
# Generate secure SESSION_SECRET (32+ characters)
openssl rand -hex 32

# Generate secure database password
openssl rand -base64 32
```

### Step 5: Deploy Application

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run initial deployment
./deploy.sh
```

The deployment script will:
1. Stop any existing containers
2. Build Docker images
3. Start containers with docker-compose
4. Wait for services to be healthy
5. Display logs

### Step 6: Verify Deployment

```bash
# Check container status
docker-compose ps

# Both containers should show "Up (healthy)"
# shopify-import-app
# shopify-import-db

# View logs
docker-compose logs -f app

# Test health endpoint
curl http://localhost:3001/api/health

# Expected response:
# {"status":"healthy","database":"connected","timestamp":"..."}
```

## Automatic Deployment via GitHub Actions

After initial setup, deployments happen automatically:

### Automatic Trigger
1. Push code to branch `claude/shopify-product-import-mvp-011CUwJS7CQA4qp5h11AL2F3` or `main`
2. GitHub Actions automatically triggers
3. Code is pulled on VM
4. Containers are rebuilt and restarted

### Manual Trigger
1. Go to GitHub repository → Actions tab
2. Select "Deploy to Google Cloud VM" workflow
3. Click "Run workflow"
4. Select branch and run

### Deployment Process
The GitHub Actions workflow:
1. SSHs into the VM
2. Navigates to `/home/ubuntu/shopify-product-import`
3. Pulls latest code from Git
4. Runs `docker-compose down` to stop containers
5. Runs `docker-compose build --no-cache` to rebuild
6. Runs `docker-compose up -d` to start
7. Verifies deployment with health checks

## Managing the Application

### View Logs

```bash
cd /home/ubuntu/shopify-product-import

# App logs only
docker-compose logs -f app

# Database logs only
docker-compose logs -f postgres

# All logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100 app
```

### Restart Application

```bash
cd /home/ubuntu/shopify-product-import

# Restart all services
docker-compose restart

# Restart just the app
docker-compose restart app

# Restart just the database
docker-compose restart postgres
```

### Stop Application

```bash
cd /home/ubuntu/shopify-product-import
docker-compose down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose down -v
```

### Start Application

```bash
cd /home/ubuntu/shopify-product-import
docker-compose up -d
```

### Update Application

```bash
cd /home/ubuntu/shopify-product-import
./deploy.sh
```

### View Container Status

```bash
cd /home/ubuntu/shopify-product-import
docker-compose ps

# Detailed resource usage
docker stats
```

### Access Database

```bash
cd /home/ubuntu/shopify-product-import

# Access PostgreSQL shell
docker-compose exec postgres psql -U shopify_user -d shopify_import

# Run a query
docker-compose exec postgres psql -U shopify_user -d shopify_import -c "SELECT COUNT(*) FROM products_queue;"

# Exit with \q
```

### View Environment Variables

```bash
cd /home/ubuntu/shopify-product-import

# View environment used by containers
docker-compose config
```

## Port Configuration

The app uses ports that don't conflict with n8n:

| Service | Internal Port | External Port | Purpose |
|---------|--------------|---------------|---------|
| App | 3000 | 3001 | HTTP API |
| PostgreSQL | 5432 | 5433 | Database |

**n8n uses port 5678** - No conflicts!

## Reverse Proxy Setup (Nginx)

To access the app via `https://produktimport.wemarket.dk`:

### Install Nginx (if not already installed)

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### Configure Nginx

Create site configuration:

```bash
sudo nano /etc/nginx/sites-available/shopify-import
```

Add this configuration:

```nginx
server {
    server_name produktimport.wemarket.dk;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeouts for large file uploads
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;

        # Max body size for CSV uploads
        client_max_body_size 10M;
    }
}
```

Enable site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/shopify-import /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Setup SSL with Let's Encrypt

```bash
# Obtain SSL certificate
sudo certbot --nginx -d produktimport.wemarket.dk

# Follow prompts to configure HTTPS
# Choose option 2: Redirect HTTP to HTTPS

# Test auto-renewal
sudo certbot renew --dry-run
```

## Backup and Restore

### Backup Database

```bash
cd /home/ubuntu/shopify-product-import

# Create backup
docker-compose exec postgres pg_dump -U shopify_user shopify_import > backup_$(date +%Y%m%d_%H%M%S).sql

# Create compressed backup
docker-compose exec postgres pg_dump -U shopify_user shopify_import | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# List backups
ls -lh backup_*.sql*
```

### Restore Database

```bash
cd /home/ubuntu/shopify-product-import

# Restore from backup
cat backup_20241108_120000.sql | docker-compose exec -T postgres psql -U shopify_user -d shopify_import

# Restore from compressed backup
gunzip -c backup_20241108_120000.sql.gz | docker-compose exec -T postgres psql -U shopify_user -d shopify_import
```

### Backup Entire Application

```bash
cd /home/ubuntu

# Stop application
cd shopify-product-import && docker-compose down

# Create backup of entire directory (excluding Docker volumes)
tar -czf shopify-import-backup-$(date +%Y%m%d).tar.gz \
    --exclude='shopify-product-import/logs' \
    --exclude='shopify-product-import/node_modules' \
    shopify-product-import/

# Restart application
cd shopify-product-import && docker-compose up -d
```

## Monitoring

### Health Checks

```bash
# Check application health
curl http://localhost:3001/api/health

# Expected response:
# {"status":"healthy","database":"connected","timestamp":"2024-11-08T12:00:00.000Z"}

# Check through Nginx (if configured)
curl https://produktimport.wemarket.dk/api/health
```

### Resource Monitoring

```bash
# Container resource usage (live)
docker stats

# Disk usage
df -h

# Check Docker disk usage
docker system df

# Memory usage
free -h

# CPU usage
top
```

### Application Logs

```bash
cd /home/ubuntu/shopify-product-import

# Real-time logs
docker-compose logs -f app

# Search logs for errors
docker-compose logs app | grep -i error

# Export logs to file
docker-compose logs app > app-logs.txt
```

## Troubleshooting

### Containers Not Starting

```bash
cd /home/ubuntu/shopify-product-import

# Check status
docker-compose ps

# View detailed logs
docker-compose logs

# Try restarting
docker-compose down
docker-compose up -d

# Check Docker daemon
sudo systemctl status docker
```

### Database Connection Errors

```bash
cd /home/ubuntu/shopify-product-import

# Check database container is running
docker-compose ps postgres

# View database logs
docker-compose logs postgres

# Test database connection
docker-compose exec postgres pg_isready -U shopify_user

# Verify DATABASE_URL in .env matches docker-compose.yml
cat .env | grep DATABASE_URL
docker-compose config | grep DATABASE_URL
```

### Port Already in Use

```bash
# Check what's using port 3001
sudo lsof -i :3001

# Check what's using port 5433
sudo lsof -i :5433

# If needed, change APP_PORT in .env and restart
```

### Application Won't Start

```bash
cd /home/ubuntu/shopify-product-import

# View detailed application logs
docker-compose logs app

# Check container health
docker-compose ps app

# Restart with full rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check environment variables
docker-compose exec app env | grep SHOPIFY
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean up Docker resources
docker system prune -a

# Remove old log files
cd /home/ubuntu/shopify-product-import
rm -f logs/*.log

# Check Docker volume usage
docker system df -v
```

### SSL Certificate Issues

```bash
# Check certificate expiry
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Test auto-renewal
sudo certbot renew --dry-run

# Restart Nginx after renewal
sudo systemctl restart nginx
```

## Security Best Practices

### 1. Firewall Configuration

```bash
# Check firewall status
sudo ufw status

# Allow necessary ports
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable
```

### 2. Environment Variables

- ✅ Never commit `.env` file to Git
- ✅ Use strong passwords (min 32 characters)
- ✅ Rotate secrets regularly
- ✅ Store secrets in GitHub Secrets

### 3. Docker Security

```bash
# Keep Docker updated
sudo apt-get update
sudo apt-get upgrade docker.io docker-compose

# Check for security vulnerabilities
docker scan shopify-import-app
```

### 4. Database Security

- ✅ Strong passwords
- ✅ Database only accessible from app container
- ✅ Regular backups
- ✅ Port 5433 not exposed to internet

## Performance Optimization

### 1. Docker Resources

Edit `docker-compose.yml` to limit resources:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
```

### 2. Database Tuning

```bash
# Access database
docker-compose exec postgres psql -U shopify_user -d shopify_import

# Check database size
SELECT pg_size_pretty(pg_database_size('shopify_import'));

# Vacuum and analyze
VACUUM ANALYZE;
```

### 3. Log Rotation

Logs are stored in Docker containers by default. To enable log rotation:

```bash
# Create /etc/docker/daemon.json
sudo nano /etc/docker/daemon.json
```

Add:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Restart Docker:

```bash
sudo systemctl restart docker
cd /home/ubuntu/shopify-product-import
docker-compose up -d
```

## Directory Structure on VM

```
/home/ubuntu/
├── n8n-production/           # Existing n8n installation (DO NOT MODIFY)
│   ├── docker-compose.yml
│   └── ...
│
└── shopify-product-import/   # Our app (completely isolated)
    ├── .env                  # Environment configuration (DO NOT COMMIT)
    ├── .git/                 # Git repository
    ├── docker-compose.yml    # Docker services configuration
    ├── Dockerfile            # Application container definition
    ├── deploy.sh             # Deployment script
    ├── server/               # Backend source code
    ├── client/               # Frontend source code
    ├── logs/                 # Application logs (created at runtime)
    ├── .dockerignore         # Files to exclude from Docker build
    └── ...
```

**Important**: Both apps (n8n and Shopify Import) run independently in separate directories with separate Docker networks and ports. They do not interfere with each other.

## Maintenance Schedule

### Daily
- ✅ Check health endpoint
- ✅ Monitor disk usage
- ✅ Review error logs

### Weekly
- ✅ Database backup
- ✅ Check Docker logs size
- ✅ Review application logs for errors

### Monthly
- ✅ Update system packages
- ✅ Update Docker images
- ✅ Test backup restoration
- ✅ Review security updates

## Support

For issues or questions:

1. **Check logs first**: `cd /home/ubuntu/shopify-product-import && docker-compose logs -f`
2. **Review GitHub Actions**: Check Actions tab for deployment errors
3. **Health check**: `curl http://localhost:3001/api/health`
4. **Container status**: `docker-compose ps`

## Quick Reference

```bash
# Common commands
cd /home/ubuntu/shopify-product-import

# Deploy latest changes
./deploy.sh

# View logs
docker-compose logs -f app

# Restart
docker-compose restart

# Stop
docker-compose down

# Start
docker-compose up -d

# Status
docker-compose ps

# Health check
curl http://localhost:3001/api/health

# Database backup
docker-compose exec postgres pg_dump -U shopify_user shopify_import > backup.sql

# Access database
docker-compose exec postgres psql -U shopify_user -d shopify_import
```

---

**Application URL**: http://34.51.239.48:3001 or https://produktimport.wemarket.dk
**Health Endpoint**: /api/health
**Repository**: https://github.com/rst-confident/Shopify-product-creator
