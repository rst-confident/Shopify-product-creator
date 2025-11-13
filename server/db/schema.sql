-- Shopify Product Import App - Database Schema (MVP)

-- Stores table: One record per Shopify store
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  shopify_domain VARCHAR(255) UNIQUE NOT NULL,
  shopify_access_token TEXT NOT NULL,
  openrouter_api_key TEXT,
  selected_ai_model VARCHAR(100) DEFAULT 'anthropic/claude-3.5-sonnet',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Sessions table: For Shopify OAuth
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  shop VARCHAR(255) NOT NULL,
  state VARCHAR(255) NOT NULL,
  is_online BOOLEAN DEFAULT false,
  scope VARCHAR(500),
  expires TIMESTAMP,
  access_token TEXT,
  import_type_preference VARCHAR(50) DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GDPR Requests table: Track GDPR compliance requests
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id SERIAL PRIMARY KEY,
  request_type VARCHAR(50) NOT NULL, -- 'data_request', 'customer_redact', 'shop_redact'
  shop_domain VARCHAR(255) NOT NULL,
  customer_id VARCHAR(255),
  customer_email VARCHAR(255),
  request_data JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
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
CREATE INDEX IF NOT EXISTS idx_sessions_shop ON sessions(shop);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_shop ON gdpr_requests(shop_domain);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_type ON gdpr_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_created ON gdpr_requests(created_at);
