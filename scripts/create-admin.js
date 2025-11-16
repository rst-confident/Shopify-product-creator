#!/usr/bin/env node

/**
 * Create Admin User Script
 *
 * Usage:
 *   node scripts/create-admin.js
 *   node scripts/create-admin.js admin@example.com password123
 */

const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('dotenv').config();

async function createAdmin() {
  // Get credentials from command line or use defaults
  const email = process.argv[2] || 'admin@wemarket.dk';
  const password = process.argv[3] || 'admin123';
  const name = process.argv[4] || 'Admin User';

  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL not found in environment variables');
    console.error('Please set DATABASE_URL in your .env file');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT email FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.error(`❌ ERROR: User with email "${email}" already exists`);
      process.exit(1);
    }

    // Hash password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    console.log('Creating admin user...');
    const result = await client.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at',
      [email, passwordHash, name, 'admin']
    );

    const user = result.rows[0];

    console.log('\n✅ Admin user created successfully!\n');
    console.log('User Details:');
    console.log('─────────────────────────────────────');
    console.log(`ID:         ${user.id}`);
    console.log(`Email:      ${user.email}`);
    console.log(`Name:       ${user.name}`);
    console.log(`Role:       ${user.role}`);
    console.log(`Created:    ${user.created_at}`);
    console.log('─────────────────────────────────────');
    console.log('\nLogin Credentials:');
    console.log(`Email:      ${email}`);
    console.log(`Password:   ${password}`);
    console.log('\n⚠️  IMPORTANT: Change this password immediately after first login!\n');

  } catch (error) {
    console.error('❌ ERROR creating admin user:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

// Run the script
createAdmin().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
