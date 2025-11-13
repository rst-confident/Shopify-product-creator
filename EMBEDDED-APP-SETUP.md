# Embedded Shopify App Setup Guide

This guide walks you through setting up your app as an embedded Shopify app.

## Prerequisites

You should have:
- ✅ Shopify Partner account
- ✅ App created in Partner Dashboard
- ✅ App credentials (API Key and Secret)
- ✅ Google Cloud VM with Docker
- ✅ Domain: produktimport.wemarket.dk

## Step 1: Configure Shopify Partner App

### 1.1 App Configuration

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Navigate to **Apps** → Your App
3. Go to **Configuration** tab
4. Configure the following:

**App URL:**
```
https://produktimport.wemarket.dk
```

**Allowed redirection URLs:**
```
https://produktimport.wemarket.dk/api/auth/callback
```

**Embedded app:**
- ✅ Enable "Embed app in Shopify admin"

**App scopes:**
- ✅ `read_products`
- ✅ `write_products`

### 1.2 Configure Webhooks

In the Partner Dashboard, go to **Configuration** → **Webhooks** and add:

**1. Customer data request:**
```
URL: https://produktimport.wemarket.dk/api/webhooks/customers/data_request
Format: JSON
```

**2. Customer data erasure:**
```
URL: https://produktimport.wemarket.dk/api/webhooks/customers/redact
Format: JSON
```

**3. Shop data erasure:**
```
URL: https://produktimport.wemarket.dk/api/webhooks/shop/redact
Format: JSON
```

**Important:** These GDPR webhooks are **required** for app approval.

### 1.3 Note Your Credentials

Copy these from the Partner Dashboard:

- **API Key (Client ID):** `your_api_key_from_partner_dashboard`
- **API Secret:** `your_api_secret_from_partner_dashboard`

## Step 2: Update Environment Variables on Production VM

### 2.1 SSH into Your VM

```bash
ssh ubuntu@34.51.239.48
```

### 2.2 Navigate to App Directory

```bash
cd /home/ubuntu/shopify-product-import
```

### 2.3 Update .env File

```bash
nano .env
```

Update or add these variables:

```env
# Shopify App Configuration
SHOPIFY_API_KEY=your_api_key_from_partner_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_partner_dashboard
SHOPIFY_SCOPES=read_products,write_products
SHOPIFY_APP_URL=https://produktimport.wemarket.dk
HOST=produktimport.wemarket.dk

# Frontend Environment Variables (for Vite)
VITE_SHOPIFY_API_KEY=your_api_key_from_partner_dashboard

# Database Configuration
POSTGRES_DB=shopify_import
POSTGRES_USER=shopify_user
POSTGRES_PASSWORD=YOUR_SECURE_DATABASE_PASSWORD

# Database URL
DATABASE_URL=postgresql://shopify_user:YOUR_SECURE_DATABASE_PASSWORD@postgres:5432/shopify_import

# Server Configuration
PORT=3001
APP_PORT=3001
NODE_ENV=production
LOG_LEVEL=info

# Session Security (IMPORTANT: Generate a secure random string)
SESSION_SECRET=YOUR_SECURE_SESSION_SECRET_HERE

# OpenRouter AI Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
DEFAULT_AI_MODEL=anthropic/claude-3.5-sonnet
```

**Generate secure secrets:**

```bash
# Generate SESSION_SECRET (minimum 32 characters)
openssl rand -hex 32

# Generate POSTGRES_PASSWORD
openssl rand -base64 32
```

**Save and exit:** Press `Ctrl + X`, then `Y`, then `Enter`

### 2.4 Verify .env File

```bash
# Check that the file is correct (don't show passwords)
cat .env | grep -v PASSWORD | grep -v SECRET
```

## Step 3: Update GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add/update these secrets:

| Secret Name | Value |
|-------------|-------|
| `SHOPIFY_API_KEY` | Your API key from Partner Dashboard |
| `SHOPIFY_API_SECRET` | Your API secret from Partner Dashboard |
| `VITE_SHOPIFY_API_KEY` | Your API key from Partner Dashboard |
| `GCP_HOST` | `34.51.239.48` |
| `GCP_USER` | `ubuntu` |
| `GCP_SSH_PRIVATE_KEY` | Your SSH private key |

## Step 4: Deploy the Updated App

### 4.1 Option A: Deploy via GitHub Actions

```bash
# From your local machine
git add .
git commit -m "Add embedded app support with App Bridge and GDPR webhooks"
git push origin claude/project-assessment-011CV5ifsvepN3EkqH7RgxJ6
```

GitHub Actions will automatically deploy to your VM.

### 4.2 Option B: Manual Deployment on VM

```bash
# On the VM
cd /home/ubuntu/shopify-product-import

# Pull latest code
git pull origin claude/project-assessment-011CV5ifsvepN3EkqH7RgxJ6

# Run deployment script
./deploy.sh
```

### 4.3 Run Database Migration

The GDPR webhooks require a new database table. Run the migration:

```bash
# On the VM
cd /home/ubuntu/shopify-product-import

# Stop the app
docker-compose down

# Run migration
docker-compose run --rm app npm run migrate

# Start the app
docker-compose up -d
```

Or if the app is already running:

```bash
# Access the app container
docker-compose exec app npm run migrate
```

## Step 5: Verify Deployment

### 5.1 Check Health

```bash
# On the VM
curl http://localhost:3001/health

# Expected response:
# {"status":"ok","database":"connected",...}
```

### 5.2 Check Logs

```bash
# On the VM
docker-compose logs -f app
```

Look for:
- ✅ "Server started"
- ✅ "Environment validation passed"
- ✅ No errors

### 5.3 Test from Browser

Visit: `https://produktimport.wemarket.dk/health`

Expected response: `{"status":"ok","database":"connected",...}`

## Step 6: Install App on Development Store

### 6.1 Create Development Store

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Click **Stores** → **Add store**
3. Select **Development store**
4. Fill in store details and create

### 6.2 Install Your App

**Option A: Via Partner Dashboard**
1. Go to **Apps** → Your App
2. Click **Test your app**
3. Select your development store
4. Click **Install app**

**Option B: Via Direct URL**

Visit this URL (replace `YOUR-STORE` with your dev store name and `YOUR_API_KEY` with your actual API key):
```
https://YOUR-STORE.myshopify.com/admin/oauth/authorize?client_id=YOUR_API_KEY
```

### 6.3 OAuth Flow

1. You'll be redirected to Shopify OAuth
2. Click **Install app**
3. You'll be redirected back to your app
4. The app should load in an iframe inside Shopify admin

### 6.4 Verify Installation

In the app, you should see:
- ✅ Upload CSV page
- ✅ Products Queue page
- ✅ Settings page
- ✅ Navigation working
- ✅ No console errors

## Step 7: Test App Functionality

### 7.1 Configure OpenRouter API

1. Go to **Settings** page
2. Enter your OpenRouter API key
3. Select **Claude 3.5 Sonnet**
4. Click **Test Connection**
5. Click **Save Settings**

### 7.2 Upload a Test CSV

1. Go to **Upload CSV** page
2. Create a test CSV file (see example below)
3. Upload the file
4. Enter supplier name
5. Click **Process File**

**Test CSV example:**
```csv
Product Name,Price,EAN,Color,Image URL
Test Product,99.00,1234567890001,Red,https://example.com/image.jpg
Test Product,99.00,1234567890002,Blue,https://example.com/image2.jpg
```

### 7.3 Review and Import

1. Review AI column mappings
2. Click **Confirm & Process**
3. Go to **Products Queue**
4. Select products
5. Click **Import Selected**
6. Check Shopify admin for imported products

## Troubleshooting

### Issue: "App Bridge initialization failed"

**Solution:**
- Check that `VITE_SHOPIFY_API_KEY` is set in `.env`
- Verify the API key matches your Partner Dashboard
- Clear browser cache and reload

### Issue: "Unauthorized - No session"

**Solution:**
- Reinstall the app from Partner Dashboard
- Check that OAuth callback URL is correct
- Verify SESSION_SECRET is set in `.env`

### Issue: "Webhook verification failed"

**Solution:**
- Verify SHOPIFY_API_SECRET is correct in `.env`
- Check webhook URLs in Partner Dashboard match your domain
- Review webhook logs: `docker-compose logs app | grep webhook`

### Issue: "Database connection error"

**Solution:**
```bash
# Check database is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL

# Test database connection
docker-compose exec postgres psql -U shopify_user -d shopify_import -c "SELECT 1"
```

### Issue: OAuth redirects to wrong URL

**Solution:**
- Verify `SHOPIFY_APP_URL` and `HOST` in `.env` match exactly
- Check Partner Dashboard URLs match
- Restart app: `docker-compose restart app`

## Monitoring

### Check App Status

```bash
# Container status
docker-compose ps

# View logs in real-time
docker-compose logs -f app

# Check recent errors
docker-compose logs app | grep -i error | tail -20

# Check webhook calls
docker-compose logs app | grep webhook
```

### Health Check

```bash
# From VM
curl http://localhost:3001/health

# From internet
curl https://produktimport.wemarket.dk/health
```

### Database Check

```bash
# Access database
docker-compose exec postgres psql -U shopify_user -d shopify_import

# Check tables exist
\dt

# Check GDPR requests table
SELECT COUNT(*) FROM gdpr_requests;

# Exit
\q
```

## Next Steps

After successful installation:

1. ✅ Test all features thoroughly
2. ✅ Monitor logs for errors
3. ✅ Test GDPR webhooks (Shopify will test these during review)
4. ✅ Submit app for review (if publishing to App Store)
5. ✅ Set up monitoring and alerts
6. ✅ Configure backup schedule

## Security Checklist

- ✅ Strong SESSION_SECRET (min 32 characters)
- ✅ Strong database password
- ✅ .env file not committed to git
- ✅ HTTPS enabled (via Caddy/Nginx)
- ✅ Firewall configured on VM
- ✅ Regular security updates
- ✅ Webhook signature verification enabled
- ✅ Rate limiting configured

## Support

For issues:
1. Check logs: `docker-compose logs -f app`
2. Check health: `curl https://produktimport.wemarket.dk/health`
3. Review this guide
4. Check Shopify Partner Dashboard for app status

## Resources

- **Shopify App Bridge Docs:** https://shopify.dev/docs/api/app-bridge
- **Shopify OAuth Docs:** https://shopify.dev/docs/apps/auth/oauth
- **GDPR Webhooks:** https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks
- **Embedded Apps Guide:** https://shopify.dev/docs/apps/tools/app-bridge/embedded-apps

---

**Congratulations!** Your app is now set up as an embedded Shopify app with full OAuth, App Bridge, and GDPR compliance! 🎉
