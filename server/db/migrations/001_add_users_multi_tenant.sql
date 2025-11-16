-- Migration: Add multi-tenant user authentication
-- Date: 2025-11-16
-- Description: Add users table and user_id to stores, remove Shopify OAuth tables

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user', -- 'admin' or 'user'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add user_id to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Create index for user_id on stores
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);

-- Create index for email on users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index for role on users
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Drop sessions table (no longer needed - no Shopify OAuth)
DROP TABLE IF EXISTS sessions CASCADE;

-- Drop gdpr_requests table (no longer needed - standalone app)
DROP TABLE IF EXISTS gdpr_requests CASCADE;

-- Remove related indexes
DROP INDEX IF EXISTS idx_sessions_shop;
DROP INDEX IF EXISTS idx_sessions_expires;
DROP INDEX IF EXISTS idx_gdpr_requests_shop;
DROP INDEX IF EXISTS idx_gdpr_requests_type;
DROP INDEX IF EXISTS idx_gdpr_requests_created;
