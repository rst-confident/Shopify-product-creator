# Deployment Troubleshooting Guide

## Issue 1: Migration Script Path Error

**Error:**
```
Migration failed: Error: ENOENT: no such file or directory, open '/home/ubuntu/shopify-product-import/dist/server/db/schema.sql'
```

**Cause:** The migration script was looking for SQL files in the compiled `dist/` directory, but SQL files don't get copied during TypeScript compilation.

**Solution:**

### Option A: Use the New Migration Script (Easiest)

```bash
# From project root
./scripts/migrate-db.sh
```

This script will automatically:
- Find the migration SQL file
- Read DATABASE_URL from .env
- Run the migration
- Show clear success/error messages

### Option B: Run Migration Manually with psql

```bash
# 1. First, check your DATABASE_URL
cat .env | grep DATABASE_URL

# 2. Run migration directly
psql "$DATABASE_URL" -f server/db/migrations/001_add_users_multi_tenant.sql

# Or if you have connection details:
psql -h localhost -U shopify_user -d shopify_import -f server/db/migrations/001_add_users_multi_tenant.sql
```

### Option C: Copy and Paste SQL

```bash
# 1. Connect to database
psql -h localhost -U shopify_user -d shopify_import

# 2. Copy contents of server/db/migrations/001_add_users_multi_tenant.sql
# 3. Paste into psql prompt
# 4. Type \q to exit
```

---

## Issue 2: PostgreSQL Connection Error

**Error:**
```
psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: No such file or directory
        Is the server running locally and accepting connections on that socket?
```

**Cause:** PostgreSQL is either not running, or connection parameters are incorrect.

### Fix PostgreSQL Connection

#### Step 1: Check if PostgreSQL is Running

```bash
sudo systemctl status postgresql
```

**If not running:**
```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Enable it to start on boot
sudo systemctl enable postgresql

# Check status again
sudo systemctl status postgresql
```

#### Step 2: Check PostgreSQL is Listening

```bash
# Check if PostgreSQL is listening on port 5432
sudo netstat -plnt | grep 5432

# Or use:
sudo ss -plnt | grep 5432
```

**Expected output:**
```
tcp   0   0 127.0.0.1:5432   0.0.0.0:*   LISTEN   12345/postgres
```

#### Step 3: Verify Database Exists

```bash
# List all databases
sudo -u postgres psql -l

# Check if shopify_import exists
sudo -u postgres psql -l | grep shopify_import
```

**If database doesn't exist:**
```bash
# Create database
sudo -u postgres createdb shopify_import

# Create user (if doesn't exist)
sudo -u postgres createuser shopify_user

# Grant privileges
sudo -u postgres psql -c "ALTER USER shopify_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE shopify_import TO shopify_user;"
```

#### Step 4: Test Connection

```bash
# Test with sudo -u postgres first
sudo -u postgres psql -d shopify_import -c "SELECT 1;"

# Test with your user
psql -h localhost -U shopify_user -d shopify_import -c "SELECT 1;"
```

**If you get password prompt:**
- Enter the password you set in DATABASE_URL
- If you don't know it, reset it:
  ```bash
  sudo -u postgres psql -c "ALTER USER shopify_user WITH PASSWORD 'newpassword';"
  ```

#### Step 5: Update .env with Correct DATABASE_URL

Your `.env` should have:

```env
DATABASE_URL=postgresql://shopify_user:your_password@localhost:5432/shopify_import
```

**Format breakdown:**
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

**Common variations:**
```bash
# Local PostgreSQL (most common)
DATABASE_URL=postgresql://shopify_user:password123@localhost:5432/shopify_import

# Using 127.0.0.1 instead of localhost
DATABASE_URL=postgresql://shopify_user:password123@127.0.0.1:5432/shopify_import

# With SSL (if required)
DATABASE_URL=postgresql://shopify_user:password123@localhost:5432/shopify_import?sslmode=require
```

#### Step 6: Test Connection from Node

```bash
# Create a test script
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => { console.log('✅ Connection successful!'); client.end(); })
  .catch((err) => { console.error('❌ Connection failed:', err.message); process.exit(1); });
"
```

---

## Complete Fresh Setup (If Nothing Works)

If you're still having issues, here's a complete PostgreSQL fresh setup:

```bash
# 1. Stop PostgreSQL
sudo systemctl stop postgresql

# 2. Start it again
sudo systemctl start postgresql

# 3. Switch to postgres user
sudo -u postgres psql

# 4. In psql, run:
CREATE DATABASE shopify_import;
CREATE USER shopify_user WITH PASSWORD 'SecurePassword123';
GRANT ALL PRIVILEGES ON DATABASE shopify_import TO shopify_user;
ALTER DATABASE shopify_import OWNER TO shopify_user;
\q

# 5. Update .env
echo "DATABASE_URL=postgresql://shopify_user:SecurePassword123@localhost:5432/shopify_import" >> .env

# 6. Test connection
psql postgresql://shopify_user:SecurePassword123@localhost:5432/shopify_import -c "SELECT 1;"

# 7. Run migration
./scripts/migrate-db.sh
```

---

## Quick Diagnostic Script

Run this to check everything:

```bash
#!/bin/bash
echo "=== PostgreSQL Diagnostics ==="
echo ""
echo "1. PostgreSQL Service Status:"
sudo systemctl status postgresql | grep Active

echo ""
echo "2. PostgreSQL Port:"
sudo ss -plnt | grep 5432

echo ""
echo "3. Databases:"
sudo -u postgres psql -l | grep shopify

echo ""
echo "4. DATABASE_URL in .env:"
grep DATABASE_URL .env

echo ""
echo "5. Test Connection:"
psql "$DATABASE_URL" -c "SELECT version();" 2>&1 | head -3
```

Save this as `check-postgres.sh`, make it executable, and run it.

---

## After Migration Success

Once migration is successful, verify it worked:

```bash
# Connect to database
psql "$DATABASE_URL"

# Check tables exist
\dt

# Check users table
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name = 'users';

# Should see: id, email, password_hash, name, role, created_at, updated_at

# Check stores table for user_id column
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name = 'stores' AND column_name = 'user_id';

# Exit
\q
```

---

## Still Having Issues?

1. **Check PostgreSQL version:**
   ```bash
   psql --version
   # Should be 12+ (14+ recommended)
   ```

2. **Check PostgreSQL logs:**
   ```bash
   sudo tail -f /var/log/postgresql/postgresql-*-main.log
   ```

3. **Check pg_hba.conf:**
   ```bash
   sudo cat /etc/postgresql/*/main/pg_hba.conf | grep -v "^#"
   ```

   Should have a line like:
   ```
   local   all   shopify_user   md5
   ```

4. **Restart PostgreSQL:**
   ```bash
   sudo systemctl restart postgresql
   ```

---

## Migration Success Checklist

After successful migration, verify:

- [ ] `users` table exists
- [ ] `stores` table has `user_id` column
- [ ] `stores` table has `store_name` column
- [ ] `sessions` table is deleted
- [ ] `gdpr_requests` table is deleted
- [ ] Indexes on `users(email)`, `users(role)`, `stores(user_id)` exist

```sql
-- Run this to verify everything:
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('users', 'stores')
ORDER BY table_name, ordinal_position;
```
