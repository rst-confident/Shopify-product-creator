#!/bin/bash

# Database Migration Script
# Run this from the project root directory

echo "========================================="
echo "Database Migration"
echo "========================================="
echo ""

# Check if migration file exists
MIGRATION_FILE="server/db/migrations/001_add_users_multi_tenant.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found at $MIGRATION_FILE"
    exit 1
fi

echo "Migration file found: $MIGRATION_FILE"
echo ""

# Check if .env exists and load DATABASE_URL
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env file with DATABASE_URL"
    exit 1
fi

source .env

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env"
    exit 1
fi

echo "Using DATABASE_URL from .env"
echo ""

# Run migration using psql
echo "Running migration..."
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✅ Migration completed successfully!"
    echo "========================================="
else
    echo ""
    echo "========================================="
    echo "❌ Migration failed!"
    echo "========================================="
    echo ""
    echo "Troubleshooting:"
    echo "1. Check PostgreSQL is running: sudo systemctl status postgresql"
    echo "2. Verify DATABASE_URL in .env is correct"
    echo "3. Test connection: psql \$DATABASE_URL -c 'SELECT 1;'"
    exit 1
fi
