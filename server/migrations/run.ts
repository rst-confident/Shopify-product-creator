import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../db';

async function runMigrations() {
  try {
    console.log('Running database migrations...');

    const schemaPath = join(__dirname, '../db/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    await pool.query(schema);

    console.log('Database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
