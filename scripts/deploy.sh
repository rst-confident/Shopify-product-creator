#!/bin/bash

# Automated Deployment Script
# This script automates the deployment process for the Shopify Product Importer

set -e  # Exit on any error

echo "========================================="
echo "Shopify Product Importer - Deployment"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

step() {
    echo -e "${BLUE}▶${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if .env exists
if [ ! -f ".env" ]; then
    error ".env file not found!"
    echo "Please create .env file from .env.example:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    exit 1
fi

# Source .env
source .env

# Check SESSION_SECRET
if [ -z "$SESSION_SECRET" ] || [ "$SESSION_SECRET" = "your_random_session_secret_minimum_32_characters" ]; then
    error "SESSION_SECRET not configured in .env!"
    echo "Generate one with: openssl rand -base64 32"
    exit 1
fi

# Step 1: Install dependencies
step "Step 1: Installing dependencies..."
npm install
success "Dependencies installed"
echo ""

# Step 2: Build application
step "Step 2: Building application..."
npm run build
success "Application built"
echo ""

# Step 3: Run database migration
step "Step 3: Running database migration..."
if [ -f "dist/server/migrations/run.js" ]; then
    npm run migrate
    success "Migration completed"
else
    warn "Migration script not found, skipping..."
    echo "You may need to run migration manually"
fi
echo ""

# Step 4: Check if admin user exists
step "Step 4: Checking admin user..."
ADMIN_EXISTS=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM users WHERE role='admin';" 2>/dev/null || echo "0")

if [ "$ADMIN_EXISTS" -eq "0" ]; then
    warn "No admin user found"
    read -p "Create admin user now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Admin email: " ADMIN_EMAIL
        read -s -p "Admin password: " ADMIN_PASSWORD
        echo
        node scripts/create-admin.js "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
    else
        warn "Skipping admin user creation"
        echo "You can create one later with: node scripts/create-admin.js"
    fi
else
    success "Admin user exists"
fi
echo ""

# Step 5: PM2 deployment
step "Step 5: Deploying with PM2..."

if ! command -v pm2 &> /dev/null; then
    error "PM2 not found!"
    echo "Install PM2 with: npm install -g pm2"
    exit 1
fi

# Stop old process if exists
if pm2 list | grep -q "shopify-import"; then
    warn "Stopping old process..."
    pm2 stop shopify-import
    pm2 delete shopify-import
fi

# Start new process
pm2 start dist/server/index.js --name shopify-import
success "Application started with PM2"

# Save PM2 configuration
pm2 save
success "PM2 configuration saved"
echo ""

# Step 6: Check application health
step "Step 6: Checking application health..."
sleep 3  # Wait for app to start

if curl -s http://localhost:3001/health > /dev/null; then
    success "Application is healthy and responding!"
    echo ""
    curl -s http://localhost:3001/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3001/health
else
    error "Application is not responding!"
    echo ""
    echo "Check logs with: pm2 logs shopify-import"
    exit 1
fi

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Application is running on: http://localhost:3001"
if [ -n "$SHOPIFY_APP_URL" ]; then
    echo "Public URL: $SHOPIFY_APP_URL"
fi
echo ""
echo "Useful commands:"
echo "  pm2 logs shopify-import    - View logs"
echo "  pm2 status                 - Check status"
echo "  pm2 monit                  - Monitor resources"
echo "  pm2 restart shopify-import - Restart app"
echo ""
