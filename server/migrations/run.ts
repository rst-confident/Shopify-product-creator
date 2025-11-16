import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pool from '../db';

async function runMigrations() {
  try {
    console.log('Running database migrations...');

    // Use process.cwd() to get the project root, not __dirname
    const projectRoot = process.cwd();
    const migrationPath = join(projectRoot, 'server/db/migrations/001_add_users_multi_tenant.sql');

    console.log('Reading migration from:', migrationPath);
    const migration = readFileSync(migrationPath, 'utf-8');

    await pool.query(migration);

    console.log('✅ Database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\nTry manual migration instead:');
    console.log('  psql -U shopify_user -d shopify_import -f server/db/migrations/001_add_users_multi_tenant.sql');
    process.exit(1);
  }
}

runMigrations();
