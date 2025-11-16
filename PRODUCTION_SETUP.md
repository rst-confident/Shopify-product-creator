# Production Server Setup Guide

## Environment Variables Setup

Your production server needs a `.env` file in the root directory (`~/shopify-product-import/.env`). Follow these steps:

### 1. Create Shopify Custom App (One Time Setup)

1. Go to your Shopify Admin
2. Navigate to: **Settings > Apps and sales channels > Develop apps**
3. Click **"Create an app"**
4. Name it (e.g., "Product Import API Client")
5. Go to **Configuration** tab
6. Under **Admin API integration**, configure scopes:
   - `read_products`
   - `write_products`
   - `read_inventory`
   - `write_inventory`
7. Click **Save**
8. Go to **API credentials** tab
9. Copy your **API key** and **API secret key**

### 2. Create .env File on Production Server

```bash
cd ~/shopify-product-import
nano .env
```

Paste the following (replace with your actual values):

```env
# App Configuration
SHOPIFY_APP_URL=https://produktimport.wemarket.dk
HOST=produktimport.wemarket.dk

# Shopify API Configuration (from Custom App you created above)
SHOPIFY_API_KEY=<your_api_key_here>
SHOPIFY_API_SECRET=<your_api_secret_here>
SHOPIFY_SCOPES=read_products,write_products,read_inventory,write_inventory

# Database Configuration
DATABASE_URL=postgresql://shopify_user:your_db_password@localhost:5432/shopify_import

# Server Configuration
PORT=3001
APP_PORT=3001
NODE_ENV=production
LOG_LEVEL=info

# Session Security (generate with: openssl rand -hex 32)
SESSION_SECRET=<run: openssl rand -hex 32>

# OpenRouter AI Configuration (optional defaults)
OPENROUTER_API_KEY=<your_openrouter_key_if_using_default>
DEFAULT_AI_MODEL=anthropic/claude-3.5-sonnet
```

### 3. Generate SESSION_SECRET

Run this command on your server:
```bash
openssl rand -hex 32
```

Copy the output and paste it as your `SESSION_SECRET` value.

### 4. Save and Deploy

After creating the `.env` file:

```bash
# Build the application
npm run build

# Restart the PM2 process
pm2 restart shopify-product-import

# Check logs
pm2 logs shopify-product-import
```

## Important Notes

### This is a Standalone App
- Users manually enter their Shopify store access tokens via the web UI
- The `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are only used to create API clients
- **No OAuth flow** - access tokens are entered manually per store
- `isEmbeddedApp: false` - this app runs standalone, not embedded in Shopify Admin

### Security
- Never commit `.env` file to git
- Keep `SESSION_SECRET` secure (minimum 32 characters)
- Store access tokens are encrypted in the database
- Each user manages their own stores and access tokens

## Troubleshooting

### Server won't start - "Missing required environment variables"
- Make sure `.env` file exists in the project root
- Check that all required variables are set
- Verify `SESSION_SECRET` is at least 32 characters

### App Bridge Error in Browser Console
- This has been fixed in the latest code
- Make sure you've pulled the latest changes
- Run `npm run build` to rebuild the client
- Clear browser cache and hard refresh

### Database Connection Errors
- Verify PostgreSQL is running: `systemctl status postgresql`
- Check DATABASE_URL is correct
- Ensure database user has proper permissions
