# Quick Start - Docker Deployment on Google Cloud VM

## What Was Set Up

Your Shopify Product Import App now has complete Docker-based deployment with automatic GitHub Actions CI/CD.

## Architecture

```
Google Cloud VM (34.51.239.48)
├── /home/ubuntu/n8n-production/          ← Existing (untouched)
└── /home/ubuntu/shopify-product-import/  ← New app (isolated)
    ├── Runs on port 3001
    ├── PostgreSQL on port 5433
    └── Separate Docker network
```

**Zero conflicts** with your existing n8n installation!

## Files Created

1. **Dockerfile** - Multi-stage build for production
2. **docker-compose.yml** - Orchestrates app + PostgreSQL
3. **deploy.sh** - Automated deployment script
4. **.dockerignore** - Optimizes Docker build
5. **.github/workflows/deploy.yml** - GitHub Actions automation
6. **DEPLOYMENT.md** - Complete deployment guide

## Setup Steps

### 1. Configure GitHub Secrets

Go to: `GitHub Repository → Settings → Secrets and variables → Actions → New repository secret`

Add these 3 secrets:

| Secret Name | Value |
|-------------|-------|
| `GCP_HOST` | `34.51.239.48` |
| `GCP_USER` | `ubuntu` |
| `GCP_SSH_PRIVATE_KEY` | (Your SSH private key that matches the public key on the VM) |

### 2. Initial Setup on VM

SSH into your VM and run these commands:

```bash
# SSH to VM
ssh ubuntu@34.51.239.48

# Create app directory (separate from n8n)
mkdir -p /home/ubuntu/shopify-product-import
cd /home/ubuntu/shopify-product-import

# Clone repository
git clone https://github.com/rst-confident/Shopify-product-creator.git .
git checkout claude/shopify-product-import-mvp-011CUwJS7CQA4qp5h11AL2F3

# Configure environment
cp .env.example .env
nano .env
```

### 3. Configure .env File

Edit the `.env` file and set these values:

```bash
# Generate secure secrets first:
openssl rand -hex 32  # Use this for SESSION_SECRET
openssl rand -base64 32  # Use this for POSTGRES_PASSWORD

# Then edit .env:
nano .env

# Set:
SHOPIFY_API_KEY=your_key_here
SHOPIFY_API_SECRET=your_secret_here
POSTGRES_PASSWORD=the_password_from_openssl_above
SESSION_SECRET=the_session_secret_from_openssl_above
OPENROUTER_API_KEY=your_openrouter_key_here
```

### 4. Deploy

```bash
# Make script executable
chmod +x deploy.sh

# Deploy!
./deploy.sh
```

The script will:
- Build Docker images
- Start containers
- Initialize database
- Show logs

### 5. Verify

```bash
# Check containers
docker-compose ps

# Should see both running:
# shopify-import-app    Up (healthy)
# shopify-import-db     Up (healthy)

# Test health endpoint
curl http://localhost:3001/api/health

# Should return:
# {"status":"healthy","database":"connected","timestamp":"..."}
```

## From Now On: Automatic Deployment

After initial setup, every time you push code to the branch, GitHub Actions will automatically:

1. SSH to your VM
2. Pull latest code
3. Rebuild Docker images
4. Restart containers
5. Verify health

**No manual steps needed!**

## Common Commands

```bash
# All commands from: /home/ubuntu/shopify-product-import

# View logs
docker-compose logs -f app

# Restart app
docker-compose restart

# Stop app
docker-compose down

# Start app
docker-compose up -d

# Update app
./deploy.sh

# Check status
docker-compose ps
```

## Accessing the App

- **Direct**: http://34.51.239.48:3001
- **With Nginx** (optional): https://produktimport.wemarket.dk

To set up Nginx reverse proxy, follow the "Reverse Proxy Setup" section in DEPLOYMENT.md.

## Troubleshooting

### Containers won't start
```bash
docker-compose logs
```

### GitHub Actions failing
Check:
1. GitHub Secrets are set correctly
2. SSH key matches the one on VM
3. Check Actions tab for detailed error logs

### Port conflicts
```bash
# Check what's using ports
sudo lsof -i :3001
sudo lsof -i :5433
```

### Need help
Check the complete guide: `DEPLOYMENT.md`

## What's Next?

1. **Initial Setup**: Complete steps 1-5 above
2. **Test**: Push a commit and watch GitHub Actions deploy automatically
3. **Configure Domain**: Set up Nginx reverse proxy (see DEPLOYMENT.md)
4. **Monitor**: Check logs regularly with `docker-compose logs -f app`

## Support

- Full documentation: `DEPLOYMENT.md`
- Architecture: `IMPORT-TYPES-ARCHITECTURE.md`
- Repository: https://github.com/rst-confident/Shopify-product-creator

---

**Status**: Ready to deploy! ✅
**Conflicts with n8n**: None ✅
**Automation**: GitHub Actions CI/CD ✅
