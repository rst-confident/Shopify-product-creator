# Deployment Guide

Complete guide to deploying the Shopify Product Import App to Google Cloud VM.

## Prerequisites

- Google Cloud VM (Ubuntu 20.04+ recommended)
- Domain configured: produktimport.wemarket.dk
- SSH access to the VM
- PostgreSQL database
- GitHub repository access

## Initial Server Setup

### 1. Connect to Your Google Cloud VM

```bash
ssh your-user@produktimport.wemarket.dk
```

### 2. Install Node.js 18

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version
```

### 3. Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version

# Configure PM2 to start on system boot
pm2 startup
# Follow the instructions it provides (usually a command to run with sudo)

# Save PM2 configuration
pm2 save
```

### 4. Install and Configure PostgreSQL

```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE shopify_product_import;
CREATE USER yourusername WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE shopify_product_import TO yourusername;
\q
EOF

# Test connection
psql -h localhost -U yourusername -d shopify_product_import
```

### 5. Install Nginx (Optional but Recommended)

```bash
# Install Nginx
sudo apt-get install -y nginx

# Configure Nginx as reverse proxy
sudo nano /etc/nginx/sites-available/shopify-product-import
```

Add this configuration:

```nginx
server {
    listen 80;
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
    }
}
```

Enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/shopify-product-import /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 6. Install SSL Certificate (Certbot)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d produktimport.wemarket.dk

# Follow prompts to configure HTTPS
# Choose option 2: Redirect HTTP to HTTPS

# Test auto-renewal
sudo certbot renew --dry-run
```

## GitHub Actions Setup

### 1. Generate SSH Key Pair

On your **local machine**:

```bash
# Generate new SSH key pair
ssh-keygen -t rsa -b 4096 -f shopify-deploy-key -N ""

# This creates two files:
# - shopify-deploy-key (private key) - Add to GitHub Secrets
# - shopify-deploy-key.pub (public key) - Add to VM
```

### 2. Add Public Key to VM

Copy the public key to your VM:

```bash
# On your local machine
cat shopify-deploy-key.pub

# SSH into your VM
ssh your-user@produktimport.wemarket.dk

# Add public key to authorized_keys
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
# Paste the public key content
# Save and exit

# Set correct permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### 3. Configure GitHub Secrets

Go to your GitHub repository:
1. Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

| Secret Name | Value | Example |
|------------|-------|---------|
| `GCP_SSH_PRIVATE_KEY` | Content of `shopify-deploy-key` (private key) | `-----BEGIN RSA PRIVATE KEY-----\n...` |
| `GCP_USER` | Your VM username | `your-username` |
| `GCP_HOST` | Your VM hostname/IP | `produktimport.wemarket.dk` or `34.123.45.67` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/shopify_product_import` |
| `SHOPIFY_API_KEY` | Shopify app API key | From Shopify Partner dashboard |
| `SHOPIFY_API_SECRET` | Shopify app API secret | From Shopify Partner dashboard |
| `SHOPIFY_SCOPES` | Shopify app scopes | `write_products,read_products` |
| `SESSION_SECRET` | Random secret string | Generate with `openssl rand -hex 32` |

### 4. Test Deployment

Push to main branch or manually trigger workflow:

```bash
# Automatic (on push to main)
git add .
git commit -m "Initial deployment setup"
git push origin main

# Manual
# Go to GitHub → Actions → Deploy to Google Cloud VM → Run workflow
```

## Manual Deployment (Without GitHub Actions)

If you prefer to deploy manually:

### 1. Build the Application

On your **local machine**:

```bash
# Install dependencies
npm ci

# Build backend and frontend
npm run build

# Create deployment archive
tar -czf deploy.tar.gz dist/ server/db/ package.json package-lock.json
```

### 2. Upload to VM

```bash
# Upload files
scp deploy.tar.gz your-user@produktimport.wemarket.dk:/tmp/

# Upload node_modules (one-time, large file)
tar -czf node_modules.tar.gz node_modules/
scp node_modules.tar.gz your-user@produktimport.wemarket.dk:/tmp/
```

### 3. Deploy on VM

SSH into your VM and run:

```bash
# Create app directory
mkdir -p ~/shopify-product-import
cd ~/shopify-product-import

# Extract files
tar -xzf /tmp/deploy.tar.gz
tar -xzf /tmp/node_modules.tar.gz

# Create .env file
nano .env
```

Add environment variables:

```env
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_SCOPES=write_products,read_products
SHOPIFY_APP_URL=https://produktimport.wemarket.dk
HOST=produktimport.wemarket.dk
DATABASE_URL=postgresql://user:pass@localhost:5432/shopify_product_import
PORT=3001
NODE_ENV=production
SESSION_SECRET=your_random_session_secret
```

### 4. Run Database Migrations

```bash
npm run migrate
```

### 5. Start Application with PM2

```bash
# Start the application
pm2 start dist/server/index.js --name shopify-product-import

# Save PM2 configuration
pm2 save

# View logs
pm2 logs shopify-product-import

# View status
pm2 status
```

## Monitoring and Maintenance

### PM2 Commands

```bash
# View application status
pm2 status

# View logs
pm2 logs shopify-product-import

# Restart application
pm2 restart shopify-product-import

# Stop application
pm2 stop shopify-product-import

# View resource usage
pm2 monit
```

### Database Backup

```bash
# Create backup
pg_dump -h localhost -U yourusername shopify_product_import > backup_$(date +%Y%m%d).sql

# Restore backup
psql -h localhost -U yourusername shopify_product_import < backup_20240101.sql
```

### Log Rotation

Configure log rotation for PM2:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### Health Checks

```bash
# Check application health
curl https://produktimport.wemarket.dk/health

# Should return:
# {"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

### Updating the Application

After pushing changes to GitHub:

1. **Automatic**: GitHub Actions will deploy automatically
2. **Manual**: SSH into VM and run:

```bash
cd ~/shopify-product-import
pm2 restart shopify-product-import
```

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs shopify-product-import --lines 100

# Check if port 3001 is in use
sudo lsof -i :3001

# Test database connection
psql -h localhost -U yourusername shopify_product_import
```

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Test connection string
node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: 'YOUR_DATABASE_URL' }); pool.query('SELECT NOW()', (err, res) => { console.log(err, res); pool.end(); });"
```

### Nginx Issues

```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Issues

```bash
# Check certificate expiry
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Test auto-renewal
sudo certbot renew --dry-run
```

## Security Best Practices

1. **Firewall Configuration**
   ```bash
   # Install UFW
   sudo apt-get install -y ufw

   # Configure firewall
   sudo ufw allow OpenSSH
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```

2. **Regular Updates**
   ```bash
   # Update system packages
   sudo apt-get update
   sudo apt-get upgrade -y
   ```

3. **Environment Variables**
   - Never commit .env files to Git
   - Use strong random strings for secrets
   - Rotate secrets regularly

4. **Database Security**
   - Use strong passwords
   - Restrict PostgreSQL to localhost
   - Regular backups

## Performance Optimization

1. **PM2 Cluster Mode** (for high traffic)
   ```bash
   pm2 start dist/server/index.js --name shopify-product-import -i max
   ```

2. **Database Connection Pooling**
   - Already configured in `server/db/index.ts`

3. **Nginx Caching**
   - Add caching directives for static assets

## Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs shopify-product-import`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Check database logs: `sudo tail -f /var/log/postgresql/postgresql-*.log`
4. Review GitHub Actions logs in repository

For additional help, create an issue in the GitHub repository.
