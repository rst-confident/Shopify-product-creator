#!/bin/bash

# Deployment Health Check Script
# Verifies all components of the deployment are working correctly

echo "========================================="
echo "Shopify Product Importer - Health Check"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check Node.js
echo "1. Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js installed: $NODE_VERSION"
else
    check_fail "Node.js not found"
    exit 1
fi

# 2. Check npm
echo ""
echo "2. Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    check_pass "npm installed: $NPM_VERSION"
else
    check_fail "npm not found"
    exit 1
fi

# 3. Check PostgreSQL
echo ""
echo "3. Checking PostgreSQL..."
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version)
    check_pass "PostgreSQL installed: $PSQL_VERSION"
else
    check_warn "psql command not found (PostgreSQL might still be installed)"
fi

# 4. Check PM2
echo ""
echo "4. Checking PM2..."
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 --version)
    check_pass "PM2 installed: $PM2_VERSION"
else
    check_warn "PM2 not found (optional, but recommended for production)"
fi

# 5. Check .env file
echo ""
echo "5. Checking .env file..."
if [ -f ".env" ]; then
    check_pass ".env file exists"

    # Check for required variables
    if grep -q "SESSION_SECRET=" .env; then
        SECRET=$(grep "SESSION_SECRET=" .env | cut -d '=' -f2)
        if [ "$SECRET" = "your_random_session_secret_minimum_32_characters" ] || [ "$SECRET" = "your-secret-key-change-this-in-production" ]; then
            check_fail "SESSION_SECRET is using default value - MUST BE CHANGED!"
        else
            check_pass "SESSION_SECRET is configured"
        fi
    else
        check_fail "SESSION_SECRET not found in .env"
    fi

    if grep -q "DATABASE_URL=" .env; then
        check_pass "DATABASE_URL is configured"
    else
        check_fail "DATABASE_URL not found in .env"
    fi

    if grep -q "NODE_ENV=" .env; then
        NODE_ENV=$(grep "NODE_ENV=" .env | cut -d '=' -f2)
        check_pass "NODE_ENV is set to: $NODE_ENV"
    else
        check_warn "NODE_ENV not set (will default to development)"
    fi
else
    check_fail ".env file not found"
    echo "   Run: cp .env.example .env"
fi

# 6. Check dependencies
echo ""
echo "6. Checking dependencies..."
if [ -d "node_modules" ]; then
    check_pass "node_modules directory exists"

    # Check for critical packages
    if [ -d "node_modules/bcrypt" ]; then
        check_pass "bcrypt installed"
    else
        check_fail "bcrypt not installed - run: npm install"
    fi

    if [ -d "node_modules/express-session" ]; then
        check_pass "express-session installed"
    else
        check_fail "express-session not installed - run: npm install"
    fi

    if [ -d "node_modules/xlsx" ]; then
        check_pass "xlsx installed"
    else
        check_fail "xlsx not installed - run: npm install"
    fi
else
    check_fail "node_modules not found - run: npm install"
fi

# 7. Check build
echo ""
echo "7. Checking build..."
if [ -d "dist/server" ]; then
    check_pass "dist/server directory exists"

    if [ -f "dist/server/index.js" ]; then
        check_pass "Server built successfully"
    else
        check_fail "dist/server/index.js not found - run: npm run build"
    fi
else
    check_fail "dist/server not found - run: npm run build"
fi

if [ -d "dist/client" ]; then
    check_pass "dist/client directory exists"
else
    check_warn "dist/client not found (frontend not built yet)"
fi

# 8. Check database connection
echo ""
echo "8. Checking database connection..."
if [ -f ".env" ]; then
    source .env
    if [ -n "$DATABASE_URL" ]; then
        # Extract database details from URL
        DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\(.*\):\([0-9]*\).*/\1/p')
        DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*@\(.*\):\([0-9]*\).*/\2/p')

        if [ -n "$DB_HOST" ]; then
            if nc -z $DB_HOST ${DB_PORT:-5432} 2>/dev/null; then
                check_pass "Database host is reachable"
            else
                check_fail "Cannot connect to database host"
            fi
        fi
    fi
fi

# 9. Check PM2 processes
echo ""
echo "9. Checking PM2 processes..."
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "shopify-import"; then
        STATUS=$(pm2 list | grep "shopify-import" | awk '{print $10}')
        if [ "$STATUS" = "online" ]; then
            check_pass "PM2 process is running"
        else
            check_warn "PM2 process exists but is not online"
        fi
    else
        check_warn "PM2 process 'shopify-import' not found"
    fi
fi

# 10. Check Nginx
echo ""
echo "10. Checking Nginx..."
if command -v nginx &> /dev/null; then
    if systemctl is-active --quiet nginx; then
        check_pass "Nginx is running"
    else
        check_warn "Nginx is installed but not running"
    fi
else
    check_warn "Nginx not found (optional)"
fi

# 11. Test API endpoint
echo ""
echo "11. Testing API endpoint..."
if command -v curl &> /dev/null; then
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        check_pass "API is responding on http://localhost:3001"
    else
        check_fail "API not responding on http://localhost:3001"
    fi
else
    check_warn "curl not found - cannot test API"
fi

echo ""
echo "========================================="
echo "Health Check Complete"
echo "========================================="
