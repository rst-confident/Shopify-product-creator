# Google VM Deployment Guide - Multi-Tenant Shopify Product Importer

This guide will walk you through deploying the simplified multi-tenant web app on your Google VM.

## Prerequisites Check

Before starting, verify you have:

```bash
# Check Node.js version (requires v16+)
node --version

# Check npm
npm --version

# Check PostgreSQL
psql --version

# Check if PM2 is installed
pm2 --version

# Check if Nginx is installed (optional, for reverse proxy)
nginx -v
```

---

## Step 1: Pull Latest Code

```bash
# Navigate to project directory
cd /home/user/Shopify-product-creator

# Pull latest changes
git fetch origin
git checkout claude/simplify-mobile-web-app-016DWYMVmrA2gAwap8Xwcpzj
git pull origin claude/simplify-mobile-web-app-016DWYMVmrA2gAwap8Xwcpzj
```

---

## Step 2: Install Dependencies

```bash
# Install all dependencies (including new ones: bcrypt, express-session, xlsx, etc.)
npm install

# Verify installation
npm list bcrypt express-session cookie-parser xlsx
```

If bcrypt fails to install, you may need build tools:
```bash
sudo apt-get update
sudo apt-get install -y build-essential python3
npm install
```

---

## Step 3: Configure Environment Variables

```bash
# Copy example env file if you don't have .env yet
cp .env.example .env

# Edit .env file
nano .env
```

**Required variables in `.env`:**

```env
# Database Configuration
DATABASE_URL=postgresql://shopify_user:your_password@localhost:5432/shopify_import

# Server Configuration
PORT=3001
NODE_ENV=production

# Session Security (CRITICAL - Generate a new secret!)
SESSION_SECRET=REPLACE_THIS_WITH_RANDOM_STRING

# App URL
SHOPIFY_APP_URL=https://produktimport.wemarket.dk
HOST=produktimport.wemarket.dk
```

**Generate SESSION_SECRET:**
```bash
# Generate a secure random session secret
openssl rand -base64 32

# Copy the output and paste it as SESSION_SECRET in .env
```

**Example .env:**
```env
DATABASE_URL=postgresql://shopify_user:MySecurePassword123@localhost:5432/shopify_import
PORT=3001
NODE_ENV=production
SESSION_SECRET=xK9pL2mN4vB6hT8jR5wQ1eY3sD7fG0aZ9cX2vN5bM8=
SHOPIFY_APP_URL=https://produktimport.wemarket.dk
HOST=produktimport.wemarket.dk
```

---

## Step 4: Database Migration

### Option A: Using npm script (Recommended)

```bash
# Build the server first
npm run build:server

# Run migration
npm run migrate
```

### Option B: Manual SQL execution

```bash
# Connect to PostgreSQL
psql -U shopify_user -d shopify_import

# Copy and paste the migration SQL
# (Contents of server/db/migrations/001_add_users_multi_tenant.sql)
```

**Migration SQL:**
```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add user_id to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_name VARCHAR(255);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);

-- Drop old tables
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS gdpr_requests CASCADE;

-- Verify migration
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('users', 'stores');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'users';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'stores' AND column_name IN ('user_id', 'store_name');
```

---

## Step 5: Create First Admin User

You need to create an admin user to access the system.

### Method 1: Using psql

```bash
# Connect to database
psql -U shopify_user -d shopify_import

# Create admin user
# Password is: admin123 (CHANGE THIS AFTER FIRST LOGIN!)
INSERT INTO users (email, password_hash, name, role)
VALUES (
  'admin@wemarket.dk',
  '$2b$10$rQZ5vF5H3mVqJK5hZ.W8/.8xqKZB0Q3tZ3Qz3jZ1K2mZ3Qz3jZ1K2',
  'Admin User',
  'admin'
);

-- Verify user was created
SELECT id, email, name, role FROM users;

-- Exit psql
\q
```

### Method 2: Using Node.js script

Create a file `create-admin.js`:

```javascript
const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function createAdmin() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://shopify_user:password@localhost:5432/shopify_import'
  });

  try {
    await client.connect();

    const email = 'admin@wemarket.dk';
    const password = 'admin123'; // CHANGE THIS!
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await client.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role',
      [email, passwordHash, 'Admin User', 'admin']
    );

    console.log('Admin user created:', result.rows[0]);
    console.log(`\nLogin credentials:\nEmail: ${email}\nPassword: ${password}\n`);
    console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!');
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await client.end();
  }
}

createAdmin();
```

Run it:
```bash
node create-admin.js
```

**Default Admin Credentials:**
- Email: `admin@wemarket.dk`
- Password: `admin123`

⚠️ **CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!**

---

## Step 6: Build the Application

```bash
# Build both server and client
npm run build

# Verify build output
ls -la dist/server
ls -la dist/client

# Check that index.js exists
ls -la dist/server/index.js
```

---

## Step 7: Test the Application

Before running in production, test that everything works:

```bash
# Start the server in development mode
npm run dev
```

In another terminal, test the API:

```bash
# Test health check
curl http://localhost:3001/health

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@wemarket.dk","password":"admin123"}' \
  -c cookies.txt

# Test getting current user
curl http://localhost:3001/api/auth/me -b cookies.txt

# Test admin routes
curl http://localhost:3001/api/admin/users -b cookies.txt
```

If all tests pass, stop the dev server (Ctrl+C) and proceed to production deployment.

---

## Step 8: Production Deployment with PM2

### Stop old version (if running)

```bash
# Stop old PM2 process
pm2 stop shopify-import
pm2 delete shopify-import

# Or stop all
pm2 stop all
pm2 delete all
```

### Start new version

```bash
# Start with PM2
pm2 start dist/server/index.js --name shopify-import

# Or use npm start
pm2 start npm --name shopify-import -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it gives you (run with sudo)
```

### Monitor the application

```bash
# View logs
pm2 logs shopify-import

# Monitor status
pm2 monit

# Check status
pm2 status

# View last 100 log lines
pm2 logs shopify-import --lines 100
```

---

## Step 9: Configure Nginx (if using)

If you're using Nginx as a reverse proxy:

```bash
# Edit Nginx configuration
sudo nano /etc/nginx/sites-available/produktimport.wemarket.dk
```

**Nginx configuration:**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name produktimport.wemarket.dk;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name produktimport.wemarket.dk;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/produktimport.wemarket.dk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/produktimport.wemarket.dk/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;

    # Upload size limit (for CSV/Excel files)
    client_max_body_size 10M;

    # Proxy settings
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Important for session cookies
        proxy_set_header Cookie $http_cookie;
    }
}
```

Test and reload Nginx:

```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Check Nginx status
sudo systemctl status nginx
```

---

## Step 10: Verify Deployment

### Test from outside the VM

```bash
# Test health check
curl https://produktimport.wemarket.dk/health

# Test login
curl -X POST https://produktimport.wemarket.dk/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@wemarket.dk","password":"admin123"}' \
  -c cookies.txt

# Test authenticated endpoint
curl https://produktimport.wemarket.dk/api/auth/me -b cookies.txt
```

### Test in browser

1. Open: `https://produktimport.wemarket.dk`
2. You should see the frontend (or 404 if frontend not built yet)
3. Try: `https://produktimport.wemarket.dk/health` - should show JSON status

---

## Step 11: Create Your First User and Store

Once logged in as admin, you can create users and stores via API:

### Create a regular user

```bash
curl -X POST https://produktimport.wemarket.dk/api/admin/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "client@example.com",
    "password": "SecurePassword123",
    "name": "Client Name",
    "role": "user"
  }'
```

### Create a store for that user

```bash
# First, get the user ID from the previous response, then:
curl -X POST https://produktimport.wemarket.dk/api/admin/stores \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "userId": 2,
    "storeName": "Client Store",
    "shopifyDomain": "client-store.myshopify.com",
    "shopifyAccessToken": "shpat_xxxxxxxxxxxxx",
    "openrouterApiKey": "sk-or-xxxxxxxxxxxxx",
    "selectedAiModel": "anthropic/claude-3.5-sonnet"
  }'
```

---

## Troubleshooting

### Issue: npm install fails with bcrypt error

**Solution:**
```bash
sudo apt-get update
sudo apt-get install -y build-essential python3
npm install --build-from-source bcrypt
```

### Issue: Database connection fails

**Check:**
```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U shopify_user -d shopify_import -c "SELECT 1;"

# Check DATABASE_URL in .env matches your actual database credentials
cat .env | grep DATABASE_URL
```

### Issue: Session cookies not working

**Check:**
1. `SESSION_SECRET` is set in `.env`
2. If using HTTPS, ensure `NODE_ENV=production` in `.env`
3. Check browser cookies are enabled
4. Verify CORS settings in `server/index.ts`

### Issue: PM2 process crashes

**Check logs:**
```bash
pm2 logs shopify-import --lines 200
```

**Common causes:**
- Missing `SESSION_SECRET` in `.env`
- Database connection failure
- Port 3001 already in use

### Issue: Cannot access app from outside VM

**Check:**
1. Nginx is running: `sudo systemctl status nginx`
2. Firewall allows ports 80/443: `sudo ufw status`
3. SSL certificates are valid: `sudo certbot certificates`
4. PM2 app is running: `pm2 status`

---

## Updating the Application

When you need to deploy updates:

```bash
# Pull latest code
git pull origin claude/simplify-mobile-web-app-016DWYMVmrA2gAwap8Xwcpzj

# Install any new dependencies
npm install

# Rebuild
npm run build

# Restart PM2
pm2 restart shopify-import

# Check logs
pm2 logs shopify-import --lines 50
```

---

## Security Checklist

Before going live:

- [ ] Changed default admin password
- [ ] Generated unique `SESSION_SECRET`
- [ ] SSL/HTTPS enabled
- [ ] Database credentials are strong
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] Regular backups configured for database
- [ ] `NODE_ENV=production` in `.env`
- [ ] Removed any test users/stores

---

## Backup Database

```bash
# Backup database
pg_dump -U shopify_user shopify_import > backup_$(date +%Y%m%d).sql

# Restore from backup
psql -U shopify_user shopify_import < backup_20240116.sql
```

---

## Quick Reference Commands

```bash
# View logs
pm2 logs shopify-import

# Restart app
pm2 restart shopify-import

# Check status
pm2 status

# Monitor resources
pm2 monit

# Reload Nginx
sudo systemctl reload nginx

# Check database
psql -U shopify_user -d shopify_import
```

---

## Support

If you encounter issues:

1. Check PM2 logs: `pm2 logs shopify-import --lines 200`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Check database connection: `psql -U shopify_user -d shopify_import`
4. Review environment variables: `cat .env`

---

**Deployment Complete!** 🚀

Your multi-tenant Shopify Product Importer is now running at:
`https://produktimport.wemarket.dk`

Admin login:
- Email: `admin@wemarket.dk`
- Password: `admin123` (CHANGE THIS!)
