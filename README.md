# Shopify Product Importer - Multi-Tenant Web Application

AI-powered product import system for Shopify stores with CSV/Excel support, intelligent column mapping, and multi-tenant user management.

## 🚀 Quick Start

### For Google VM Deployment

See **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** for complete step-by-step deployment instructions.

Quick deployment:
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
nano .env  # Set SESSION_SECRET and DATABASE_URL

# 3. Deploy
./scripts/deploy.sh
```

### For Local Development

```bash
# 1. Install dependencies
npm install

# 2. Setup database
createdb shopify_import
npm run migrate

# 3. Create admin user
node scripts/create-admin.js

# 4. Start development server
npm run dev
```

## 📋 Features

### Multi-Tenant System
- **User Management**: Admin can create and manage user accounts
- **Store Management**: Each user can manage multiple Shopify stores
- **Data Isolation**: Complete separation between user data
- **Role-Based Access**: Admin and user roles with different permissions

### Product Import
- **File Support**: CSV, Excel (.xlsx, .xls)
- **AI Column Mapping**: Automatic field detection using OpenRouter AI
- **Smart Processing**: SKU generation, duplicate detection, variant grouping
- **Multiple Import Types**:
  - Normal: Full product creation/update
  - Pre-order: Inventory management with Danish metafields
  - Inventory Change: Update stock levels only

### Authentication & Security
- Session-based authentication with bcrypt password hashing
- 7-day session expiration
- HTTPS-only cookies in production
- Rate limiting on all API routes
- Store ownership verification on every request

## 🏗️ Architecture

### Backend
- **Framework**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **Authentication**: express-session + bcrypt
- **API Integration**: Shopify GraphQL, OpenRouter AI
- **File Processing**: csv-parse, xlsx

### Frontend
- **Framework**: React 18 + TypeScript
- **UI Library**: Shopify Polaris
- **Build Tool**: Vite
- **Routing**: React Router

## 📁 Project Structure

```
shopify-product-creator/
├── server/
│   ├── db/
│   │   ├── schema.sql              # Database schema
│   │   └── migrations/             # Database migrations
│   ├── middleware/
│   │   └── auth.ts                 # Authentication middleware
│   ├── routes/
│   │   ├── auth.ts                 # Login/logout
│   │   ├── admin.ts                # User/store management
│   │   ├── user-stores.ts          # User's store operations
│   │   ├── upload.ts               # File upload
│   │   ├── mapping.ts              # AI column mapping
│   │   ├── process.ts              # Product processing
│   │   ├── queue.ts                # Product queue
│   │   └── import.ts               # Shopify import
│   ├── utils/
│   │   ├── password.ts             # Password hashing
│   │   ├── shopify-helpers.ts      # Shopify API
│   │   └── ...
│   └── index.ts                    # Server entry point
├── src/                            # React frontend
├── scripts/
│   ├── deploy.sh                   # Automated deployment
│   ├── create-admin.js             # Create admin user
│   └── check-deployment.sh         # Health check
├── DEPLOYMENT_GUIDE.md             # Deployment instructions
└── MIGRATION_GUIDE.md              # Migration from old version
```

## 🔐 Environment Variables

Required variables in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shopify_import

# Server
PORT=3001
NODE_ENV=production

# Security (CRITICAL - Generate unique value!)
SESSION_SECRET=<generate with: openssl rand -base64 32>

# App URL
SHOPIFY_APP_URL=https://your-domain.com
```

## 🗄️ Database Schema

### Users Table
- Stores user accounts with email, password hash, name, and role

### Stores Table
- Links to users, contains Shopify credentials and OpenRouter API keys

### Uploaded Files Table
- Tracks CSV/Excel uploads with mapping configurations

### Products Queue Table
- Stores processed products awaiting import

## 🔌 API Routes

### Public Routes
- `POST /api/auth/login` - User login

### Authenticated Routes (All Users)
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/user/stores` - Get user's stores
- `POST /api/user/stores` - Create store
- `PUT /api/user/stores/:id` - Update store
- `DELETE /api/user/stores/:id` - Delete store

### Admin Routes (Admin Only)
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/stores` - List all stores
- `POST /api/admin/stores` - Create store for user

### Product Import Routes
- `POST /api/upload` - Upload CSV/Excel
- `POST /api/mapping/ai-suggest` - Get AI mapping
- `POST /api/process` - Process products
- `GET /api/queue` - Get product queue
- `POST /api/import` - Import to Shopify

All routes (except login) require authentication and verify store ownership.

## 🛠️ Scripts

```bash
# Development
npm run dev              # Start dev server (hot reload)

# Build
npm run build            # Build server + client
npm run build:server     # Build server only
npm run build:client     # Build client only

# Production
npm start                # Start production server

# Database
npm run migrate          # Run migrations

# Deployment
./scripts/deploy.sh      # Automated deployment
./scripts/check-deployment.sh  # Health check
node scripts/create-admin.js   # Create admin user
```

## 📊 Monitoring

### PM2 Commands
```bash
pm2 status               # Check status
pm2 logs shopify-import  # View logs
pm2 monit                # Monitor resources
pm2 restart shopify-import  # Restart app
```

### Health Check
```bash
curl http://localhost:3001/health
```

## 🔄 Updating

```bash
# Pull latest code
git pull

# Install new dependencies
npm install

# Rebuild
npm run build

# Restart
pm2 restart shopify-import
```

## 🐛 Troubleshooting

### Common Issues

**bcrypt installation fails:**
```bash
sudo apt-get install -y build-essential python3
npm install
```

**Database connection error:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

**Session cookies not working:**
- Ensure `SESSION_SECRET` is set in `.env`
- Check `NODE_ENV=production` for HTTPS
- Verify browser allows cookies

**PM2 process crashes:**
```bash
pm2 logs shopify-import --lines 200
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed troubleshooting.

## 📝 Default Credentials

**First admin user:**
- Email: `admin@wemarket.dk`
- Password: `admin123`

⚠️ **CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!**

## 🔒 Security

- Passwords hashed with bcrypt (10 rounds)
- Session-based authentication (7-day expiration)
- HTTPS-only cookies in production
- Rate limiting on all API routes
- SQL injection protection via parameterized queries
- CORS configured for specific domain
- Store ownership verified on every request

## 📚 Documentation

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Migration from Shopify embedded app

## 📄 License

MIT

---

**Multi-Tenant Shopify Product Importer** - Simplifying product imports with AI-powered automation
