# Initial Setup Guide

Complete guide to setting up the Shopify Product Import App from scratch.

## Part 1: Shopify Partner Setup

### 1. Create Shopify Partner Account

1. Go to https://partners.shopify.com/
2. Sign up for a free Partner account
3. Complete the registration process

### 2. Create a New App

1. Log in to Shopify Partner Dashboard
2. Click "Apps" in the left sidebar
3. Click "Create app"
4. Select "Create app manually"
5. Fill in app details:
   - **App name**: Product Import App (or your preferred name)
   - **App URL**: `https://produktimport.wemarket.dk`
   - **Allowed redirection URL(s)**:
     ```
     https://produktimport.wemarket.dk/api/auth/callback
     ```

### 3. Configure App Settings

1. Go to your app's settings
2. Note down:
   - **API key** (Client ID)
   - **API secret** (Client secret)
3. Under "App setup" → "Configuration":
   - **Embedded app**: Yes
   - **Scopes**: Add these scopes:
     - `read_products`
     - `write_products`

### 4. Get Your App Credentials

You'll need these for environment variables:
- `SHOPIFY_API_KEY` = Your app's API key
- `SHOPIFY_API_SECRET` = Your app's API secret
- `SHOPIFY_SCOPES` = `write_products,read_products`

## Part 2: OpenRouter Setup

### 1. Create OpenRouter Account

1. Go to https://openrouter.ai/
2. Sign up for an account
3. Add credits to your account (AI mapping uses credits)

### 2. Generate API Key

1. Go to https://openrouter.ai/keys
2. Click "Create Key"
3. Copy your API key (starts with `sk-or-v1-...`)
4. Save this key securely

**Note**: Each user will configure their own OpenRouter key in the app settings. The key above is just for testing.

## Part 3: Database Setup

### 1. Install PostgreSQL

**On Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
```

**On macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**On Windows:**
Download and install from https://www.postgresql.org/download/windows/

### 2. Create Database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE shopify_product_import;
CREATE USER shopify_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE shopify_product_import TO shopify_user;
\q
```

### 3. Note Connection String

Your `DATABASE_URL` will be:
```
postgresql://shopify_user:your_secure_password@localhost:5432/shopify_product_import
```

## Part 4: Local Development Setup

### 1. Clone Repository

```bash
git clone <your-repository-url>
cd shopify-product-import
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
nano .env
```

Update with your values:

```env
# Shopify App Configuration
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
SHOPIFY_SCOPES=write_products,read_products
SHOPIFY_APP_URL=https://produktimport.wemarket.dk
HOST=produktimport.wemarket.dk

# Database
DATABASE_URL=postgresql://shopify_user:your_password@localhost:5432/shopify_product_import

# Server
PORT=3001
NODE_ENV=development

# Session
SESSION_SECRET=generate_random_string_here
```

To generate a session secret:
```bash
openssl rand -hex 32
```

### 4. Run Database Migrations

```bash
npm run migrate
```

You should see:
```
Running database migrations...
Database migrations completed successfully!
```

### 5. Start Development Server

```bash
npm run dev
```

You should see:
```
🚀 Shopify Product Import Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment: development
Port: 3001
Host: localhost
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Frontend will be available at: http://localhost:3000

## Part 5: Development Testing

### 1. Test with ngrok (for Shopify OAuth)

Since Shopify requires HTTPS, use ngrok for local development:

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok
ngrok http 3001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and update:

1. **Shopify Partner Dashboard**:
   - App URL: `https://abc123.ngrok.io`
   - Allowed redirection URL: `https://abc123.ngrok.io/api/auth/callback`

2. **Your .env file**:
   ```env
   SHOPIFY_APP_URL=https://abc123.ngrok.io
   HOST=abc123.ngrok.io
   ```

3. Restart your server

### 2. Install App on Development Store

1. In Shopify Partner Dashboard, create a Development Store:
   - Apps → Development stores → Create store
   - Fill in store details
   - Create store

2. Install your app:
   - Go to Apps → Your app
   - Click "Select store"
   - Select your development store
   - Click "Install app"

3. You'll be redirected to your app URL
4. Complete OAuth flow

### 3. Test the App

1. **Configure OpenRouter**:
   - Go to Settings
   - Enter your OpenRouter API key
   - Select "Claude 3.5 Sonnet"
   - Click "Test Connection"
   - Click "Save Settings"

2. **Upload Test CSV**:
   - Create a test CSV file (see example below)
   - Go to Upload CSV
   - Upload the file
   - Enter supplier name
   - Click "Process File"

3. **Review Mapping**:
   - Review AI suggestions
   - Adjust if needed
   - Click "Confirm & Process"

4. **Import Products**:
   - Go to Products Queue
   - Select products
   - Click "Import Selected"
   - Check Shopify admin for imported products

## Part 6: Production Deployment

See `DEPLOYMENT.md` for complete production deployment guide.

### Quick Checklist

- [ ] Google Cloud VM set up
- [ ] Domain configured (produktimport.wemarket.dk)
- [ ] PostgreSQL installed on VM
- [ ] Node.js 18+ installed on VM
- [ ] PM2 installed on VM
- [ ] Nginx configured with SSL
- [ ] GitHub secrets configured
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] App deployed and running
- [ ] Health check passes

## Sample CSV for Testing

Create a file `test-products.csv`:

```csv
Product Name,Price,EAN,SKU,Color,Image URL,Fabric,Care Instructions,Quality
Winter Coat Black,599.00,1234567890001,WC-001,Black,https://example.com/coat-black.jpg,100% Wool,Dry clean only,Premium
Winter Coat Red,599.00,1234567890002,WC-002,Red,https://example.com/coat-red.jpg,100% Wool,Dry clean only,Premium
Summer Dress Blue,349.00,1234567890003,SD-001,Blue,https://example.com/dress-blue.jpg,Cotton blend,Machine wash cold,Standard
Summer Dress White,349.00,1234567890004,SD-002,White,https://example.com/dress-white.jpg,Cotton blend,Machine wash cold,Standard
Leather Jacket,899.00,1234567890005,LJ-001,Brown,https://example.com/jacket-brown.jpg,Genuine leather,Professional clean,Premium
Cotton T-Shirt Red,79.00,1234567890006,TS-001,Red,https://example.com/tshirt-red.jpg,100% Cotton,Machine wash,Basic
Cotton T-Shirt Blue,79.00,1234567890007,TS-002,Blue,https://example.com/tshirt-blue.jpg,100% Cotton,Machine wash,Basic
Wool Sweater,299.00,1234567890008,WS-001,Grey,https://example.com/sweater-grey.jpg,Merino wool,Hand wash,Premium
```

## Troubleshooting Setup Issues

### Issue: Database connection failed

**Solution:**
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Verify DATABASE_URL is correct
3. Test connection: `psql -h localhost -U shopify_user shopify_product_import`
4. Check PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-*.log`

### Issue: Shopify OAuth fails

**Solution:**
1. Verify SHOPIFY_API_KEY and SHOPIFY_API_SECRET are correct
2. Check App URL matches in Shopify Partner Dashboard and .env
3. Ensure redirect URL includes `/api/auth/callback`
4. For local dev, ensure ngrok URL is up-to-date

### Issue: OpenRouter connection fails

**Solution:**
1. Verify API key is correct (starts with `sk-or-v1-`)
2. Check you have credits on OpenRouter account
3. Try the test connection feature in Settings
4. Check OpenRouter status: https://openrouter.ai/status

### Issue: CSV upload fails

**Solution:**
1. Ensure file is valid CSV format
2. Check file size (max 10MB)
3. Verify supplier name is provided
4. Check server logs for detailed error
5. Ensure `uploads/` directory exists and is writable

### Issue: Build fails

**Solution:**
1. Delete node_modules and reinstall: `rm -rf node_modules && npm install`
2. Clear build cache: `rm -rf dist/`
3. Check Node.js version: `node --version` (should be 18+)
4. Check TypeScript errors: `npx tsc --noEmit`

## Getting Help

### Useful Commands

```bash
# Check application logs
pm2 logs shopify-product-import

# Check database tables
psql -h localhost -U shopify_user shopify_product_import
\dt

# Test API health
curl http://localhost:3001/health

# Check TypeScript compilation
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.server.json
```

### Resources

- **Shopify API Documentation**: https://shopify.dev/docs/api
- **OpenRouter Documentation**: https://openrouter.ai/docs
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/

### Support

Create an issue in the GitHub repository with:
1. Description of the problem
2. Steps to reproduce
3. Error messages/logs
4. Environment details (OS, Node version, etc.)

## Next Steps

After successful setup:

1. **Test thoroughly** with various CSV formats
2. **Configure monitoring** (PM2, logs, health checks)
3. **Set up backups** for database
4. **Document your CSV format** for users
5. **Train users** on the app workflow
6. **Monitor AI costs** on OpenRouter
7. **Plan for scale** (upgrade server, optimize database)

Congratulations! Your Shopify Product Import App is ready to use! 🎉
