-- Shopify Product Import App - Database Schema (Multi-Tenant)

-- Users table: User accounts with authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user', -- 'admin' or 'user'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stores table: One record per Shopify store (linked to user)
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  shopify_domain VARCHAR(255) NOT NULL,
  store_name VARCHAR(255) NOT NULL,
  shopify_access_token TEXT NOT NULL,
  openrouter_api_key TEXT,
  selected_ai_model VARCHAR(100) DEFAULT 'anthropic/claude-3.5-sonnet',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stores_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Uploaded files table: Track each CSV upload
CREATE TABLE IF NOT EXISTS uploaded_files (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  supplier_name VARCHAR(255) NOT NULL,
  notes TEXT,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'uploaded',
  row_count INTEGER,
  mapping_config JSONB,
  CONSTRAINT uploaded_files_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Products queue table: Products awaiting import
CREATE TABLE IF NOT EXISTS products_queue (
  id SERIAL PRIMARY KEY,
  uploaded_file_id INTEGER REFERENCES uploaded_files(id) ON DELETE CASCADE,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  product_title VARCHAR(500) NOT NULL,
  base_title VARCHAR(500),
  price DECIMAL(10, 2),
  ean VARCHAR(100),
  sku VARCHAR(100),
  color VARCHAR(100),
  image_urls JSONB,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  parent_group_id VARCHAR(100),
  product_identifier VARCHAR(32),
  shopify_product_id VARCHAR(255),
  matched_shopify_product_id VARCHAR(255),
  matched_shopify_variant_id VARCHAR(255),
  import_action VARCHAR(50),
  import_type VARCHAR(50) DEFAULT 'normal',
  inventory_quantity INTEGER DEFAULT 0,
  pre_order_timing VARCHAR(50),
  pre_order_month VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT products_queue_uploaded_file_id_fkey FOREIGN KEY (uploaded_file_id) REFERENCES uploaded_files(id),
  CONSTRAINT products_queue_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Product variants table: Track color variants
CREATE TABLE IF NOT EXISTS product_variants (
  id SERIAL PRIMARY KEY,
  product_queue_id INTEGER REFERENCES products_queue(id) ON DELETE CASCADE,
  parent_group_id VARCHAR(100) NOT NULL,
  variant_type VARCHAR(50) DEFAULT 'color',
  variant_value VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_variants_product_queue_id_fkey FOREIGN KEY (product_queue_id) REFERENCES products_queue(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_store_id ON uploaded_files(store_id);
CREATE INDEX IF NOT EXISTS idx_products_queue_store_id ON products_queue(store_id);
CREATE INDEX IF NOT EXISTS idx_products_queue_uploaded_file_id ON products_queue(uploaded_file_id);
CREATE INDEX IF NOT EXISTS idx_products_queue_ean ON products_queue(ean);
CREATE INDEX IF NOT EXISTS idx_products_queue_sku ON products_queue(sku);
CREATE INDEX IF NOT EXISTS idx_products_queue_status ON products_queue(status);
CREATE INDEX IF NOT EXISTS idx_products_queue_parent_group ON products_queue(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_products_queue_shopify_id ON products_queue(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_products_queue_base_title ON products_queue(base_title);
CREATE INDEX IF NOT EXISTS idx_products_queue_product_identifier ON products_queue(product_identifier);
CREATE INDEX IF NOT EXISTS idx_products_queue_matched_shopify_id ON products_queue(matched_shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_products_queue_matched_variant_id ON products_queue(matched_shopify_variant_id);
CREATE INDEX IF NOT EXISTS idx_products_queue_import_type ON products_queue(import_type);
CREATE INDEX IF NOT EXISTS idx_product_variants_parent_group ON product_variants(parent_group_id);
