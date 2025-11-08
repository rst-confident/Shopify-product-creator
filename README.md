# Shopify Product Import App - MVP

AI-powered CSV to Shopify product importer. Upload CSV files, let AI map columns automatically, and import products to Shopify with smart variant grouping and duplicate detection.

## Features (MVP)

### Core Functionality
- **CSV Upload**: Drag-and-drop CSV file upload with supplier tracking
- **AI Column Mapping**: Automatic column mapping using OpenRouter AI (Claude 3.5 Sonnet)
- **Manual Mapping Override**: Review and adjust AI suggestions
- **Smart Processing**:
  - Duplicate EAN detection (checks existing Shopify products)
  - Automatic SKU generation
  - Color variant grouping
  - Description field combining
- **Products Queue**: Review products before import
- **Shopify Import**: Batch import with progress tracking and error handling

### Pages
1. **Settings** - Configure OpenRouter API key and AI model
2. **Upload CSV** - Upload and process CSV files
3. **Products Queue** - Manage products awaiting import

## Tech Stack

### Frontend
- React 18 + TypeScript
- Shopify Polaris (UI components)
- Vite (build tool)
- React Router

### Backend
- Node.js + Express
- TypeScript
- PostgreSQL (database)
- Shopify API (GraphQL)
- OpenRouter API (AI mapping)

### Infrastructure
- Google Cloud VM
- GitHub Actions (CI/CD)
- PM2 (process manager)
- Domain: produktimport.wemarket.dk

## Project Structure

```
shopify-product-import/
├── server/                 # Backend Node.js/Express
│   ├── db/                # Database connection and schema
│   ├── middleware/        # Auth and other middleware
│   ├── routes/            # API routes
│   ├── shopify/           # Shopify integration
│   └── index.ts           # Server entry point
├── src/                   # Frontend React app
│   ├── components/        # React components
│   ├── pages/             # Page components
│   ├── utils/             # API client and utilities
│   └── App.tsx            # Main app component
├── .github/workflows/     # GitHub Actions
├── dist/                  # Build output
└── uploads/               # Temporary file uploads

```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Shopify Partner account
- OpenRouter API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd shopify-product-import
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Set up database**
   ```bash
   npm run migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Environment Variables

Required environment variables (see `.env.example`):

```env
# Shopify App Configuration
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_SCOPES=write_products,read_products
SHOPIFY_APP_URL=https://produktimport.wemarket.dk
HOST=produktimport.wemarket.dk

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shopify_product_import

# Server
PORT=3001
NODE_ENV=production

# Session
SESSION_SECRET=your_random_session_secret
```

## Deployment

### GitHub Actions Setup

Required secrets in GitHub repository settings:

- `GCP_SSH_PRIVATE_KEY` - SSH private key for Google Cloud VM
- `GCP_USER` - Username on Google Cloud VM
- `GCP_HOST` - Google Cloud VM hostname/IP
- `DATABASE_URL` - PostgreSQL connection string
- `SHOPIFY_API_KEY` - Shopify app API key
- `SHOPIFY_API_SECRET` - Shopify app API secret
- `SHOPIFY_SCOPES` - Shopify app scopes (comma-separated)
- `SESSION_SECRET` - Random session secret

### Deployment Process

Automatic deployment on push to main branch:

```bash
git push origin main
```

Manual deployment:
- Go to GitHub Actions
- Select "Deploy to Google Cloud VM"
- Click "Run workflow"

### Server Setup (One-time)

On your Google Cloud VM:

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Configure PostgreSQL
sudo -u postgres createdb shopify_product_import
sudo -u postgres createuser yourusername

# Set up Nginx (optional, for HTTPS)
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

See `DEPLOYMENT.md` for detailed deployment instructions.

## Usage Guide

### 1. Configure OpenRouter API

1. Go to Settings page
2. Enter your OpenRouter API key from https://openrouter.ai/keys
3. Select AI model (Claude 3.5 Sonnet recommended)
4. Test connection
5. Save settings

### 2. Upload CSV File

1. Go to Upload CSV page
2. Drag and drop your CSV file (or click to browse)
3. Enter supplier name
4. (Optional) Add notes
5. Click "Process File"

### 3. Review Column Mappings

1. AI automatically suggests column mappings
2. Review the suggestions (green = high confidence)
3. Adjust mappings using dropdowns if needed
4. Required: Map at least "Title" and "Price"
5. Click "Confirm & Process"

### 4. Review Products Queue

1. Go to Products Queue page
2. Review processed products
3. Select products to import (or "Select All")
4. Click "Import Selected"
5. Confirm import

### 5. Products Imported!

Products are created in Shopify as **drafts**. Go to your Shopify admin to publish them.

## CSV Format

Your CSV should include columns for:

- **Product Title** (required)
- **Price** (required)
- **EAN/Barcode** (recommended for duplicate detection)
- **SKU** (optional, auto-generated if not provided)
- **Color** (for variant grouping)
- **Image URLs** (up to 3)
- **Description fields** (fabric, quality, fit, care, material, style, etc.)

Example CSV:

```csv
Product Name,Price,EAN,Color,Image URL,Fabric,Care Instructions
Winter Coat,599.00,1234567890123,Black,https://...,Wool,Dry clean only
Winter Coat,599.00,1234567890124,Red,https://...,Wool,Dry clean only
Summer Dress,349.00,1234567890125,Blue,https://...,Cotton,Machine wash
```

## API Endpoints

### Settings
- `GET /api/settings` - Get current settings
- `POST /api/settings` - Update settings
- `POST /api/settings/test-connection` - Test OpenRouter API key

### Upload
- `POST /api/upload` - Upload CSV file
- `GET /api/upload` - Get upload history

### Mapping
- `POST /api/mapping/ai-suggest` - Get AI mapping suggestions
- `POST /api/mapping/save` - Save mapping configuration
- `GET /api/mapping/fields` - Get available Shopify fields

### Process
- `POST /api/process` - Process products with mappings

### Queue
- `GET /api/queue` - Get products in queue
- `DELETE /api/queue` - Delete products from queue
- `GET /api/queue/stats` - Get queue statistics

### Import
- `POST /api/import` - Import products to Shopify

## Database Schema

### Tables
- **stores** - Shopify store configurations
- **uploaded_files** - CSV upload tracking
- **products_queue** - Products awaiting import
- **product_variants** - Color variant tracking
- **sessions** - Shopify OAuth sessions

See `server/db/schema.sql` for complete schema.

## Development

### Build Commands

```bash
# Development mode (hot reload)
npm run dev

# Build backend
npm run build:server

# Build frontend
npm run build:client

# Build both
npm run build

# Run production build
npm start

# Run database migrations
npm run migrate
```

### Code Structure

- **Backend Routes**: `server/routes/`
  - `auth.ts` - Shopify OAuth
  - `settings.ts` - Settings management
  - `upload.ts` - CSV upload
  - `mapping.ts` - AI mapping
  - `process.ts` - Product processing
  - `queue.ts` - Queue management
  - `import.ts` - Shopify import

- **Frontend Pages**: `src/pages/`
  - `SettingsPage.tsx` - Settings UI
  - `UploadPage.tsx` - Upload UI
  - `QueuePage.tsx` - Queue UI

- **Frontend Components**: `src/components/`
  - `MappingReview.tsx` - Column mapping interface

## Troubleshooting

### Common Issues

**1. "OpenRouter API key not configured"**
- Go to Settings and configure your OpenRouter API key

**2. "Failed to import products"**
- Check that you have the correct Shopify scopes: `write_products,read_products`
- Verify your Shopify app is installed on the store

**3. "Database connection error"**
- Check DATABASE_URL in .env
- Ensure PostgreSQL is running
- Run migrations: `npm run migrate`

**4. CSV upload fails**
- Ensure file is valid CSV format
- Check file size (max 10MB)
- Verify supplier name is provided

**5. AI mapping not working**
- Test your OpenRouter API key in Settings
- Check you have credits on OpenRouter account
- Try manual mapping as fallback

## Future Enhancements (Post-MVP)

See the roadmap document for planned features:
- Delivery date tracking
- Supplier management system
- Mapping templates
- Dashboard with analytics
- Import history and archive
- Advanced filtering and bulk operations

## Support

For issues and feature requests, please create an issue in the GitHub repository.

## License

MIT License
