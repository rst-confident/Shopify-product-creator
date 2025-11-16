# Production Server Setup Guide

## Environment Variables Setup

Your production server needs a `.env` file in the root directory (`~/shopify-product-import/.env`).

### Create .env File on Production Server

```bash
cd ~/shopify-product-import
nano .env
```

Paste the following (replace with your actual values):

```env
# App Configuration
SHOPIFY_APP_URL=https://produktimport.wemarket.dk
HOST=produktimport.wemarket.dk

# Database Configuration
DATABASE_URL=postgresql://shopify_user:your_db_password@localhost:5432/shopify_import

# Server Configuration
PORT=3001
NODE_ENV=production
LOG_LEVEL=info

# Session Security (generate with: openssl rand -hex 32)
SESSION_SECRET=<run_the_command_below_and_paste_here>

# OpenRouter AI Configuration (optional defaults)
OPENROUTER_API_KEY=<your_openrouter_key_if_using_default>
DEFAULT_AI_MODEL=anthropic/claude-3.5-sonnet
```

### Generate SESSION_SECRET

Run this command on your server:
```bash
openssl rand -hex 32
```

Copy the output and paste it as your `SESSION_SECRET` value in the `.env` file.

Save the file: `Ctrl+X`, then `Y`, then `Enter`

### Deploy the Application

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

### This is a 100% Standalone Web Application
- **No Shopify app credentials needed** - the app makes direct API calls
- Users manually enter their Shopify store access tokens via the web UI
- **No OAuth flow** - access tokens are entered manually per store
- Each store's access token is stored securely in the database
- The app is NOT embedded in Shopify Admin - it's a completely independent web app

### Security
- Never commit `.env` file to git
- Keep `SESSION_SECRET` secure (minimum 32 characters)
- Store access tokens are encrypted in the database
- Each user manages their own stores and access tokens

## How Users Add Their Stores

1. User logs into the web app
2. Goes to "My Stores" page
3. Clicks "Add Store"
4. Enters:
   - Store name (friendly name)
   - Shopify domain (e.g., "mystore.myshopify.com")
   - **Shopify access token** (from their Shopify Custom App)
   - OpenRouter API key (optional, for AI features)
5. Access token is encrypted and stored in database
6. User can now upload CSVs and import products to that store

### How Users Get Their Shopify Access Token

Each user needs to create a **Custom App** in their own Shopify store:

1. Go to their **Shopify Admin**
2. **Settings → Apps and sales channels → Develop apps**
3. Click **"Create an app"** → Name it anything (e.g., "Product Importer")
4. **Configuration tab** → Under **Admin API integration**, select scopes:
   - `read_products`
   - `write_products`
   - `read_inventory`
   - `write_inventory`
5. **Save** → Go to **API credentials tab**
6. Click **"Install app"**
7. Copy the **Admin API access token**
8. Paste this token into the web app when adding their store

## Troubleshooting

### Server won't start - "Missing required environment variables"
- Make sure `.env` file exists in the project root
- Required variables: `HOST`, `DATABASE_URL`, `SESSION_SECRET`
- Verify `SESSION_SECRET` is at least 32 characters
- **Note**: No Shopify API credentials are needed at the server level

### App Bridge Error in Browser Console
- This has been fixed in the latest code
- Make sure you've pulled the latest changes
- Run `npm run build` to rebuild the client
- Clear browser cache and hard refresh

### Database Connection Errors
- Verify PostgreSQL is running: `systemctl status postgresql`
- Check DATABASE_URL is correct
- Ensure database user has proper permissions
