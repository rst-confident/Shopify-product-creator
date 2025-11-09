# Product Creation & SKU Strategy

## Problem Statement

When importing products with color variants, we need to:
1. **Generate meaningful SKUs** (not just sequential numbers)
2. **Detect existing products** in Shopify
3. **Add variants to existing products** instead of creating duplicates
4. **Maintain consistent SKU patterns** across all variants

---

## Current Problems

### ❌ Problem 1: Arbitrary SKU Generation
```typescript
// Current code
if (!product.sku) {
  skuCounter++;
  product.sku = `SKU${skuCounter}`;  // SKU1001, SKU1002, etc.
}
```

**Issue:** "Winter Coat - Black" → `SKU1001`, "Winter Coat - Red" → `SKU1002`
No relationship between SKUs of same product.

### ❌ Problem 2: Creates Duplicate Products
```
CSV Upload 1: "Winter Coat - Black" → Creates "Winter Coat" product with Black variant
CSV Upload 2: "Winter Coat - Red"   → Creates ANOTHER "Winter Coat" product with Red variant
```

**Result:** Two separate "Winter Coat" products in Shopify instead of one product with two color variants.

### ❌ Problem 3: No Product Matching
Current code only checks duplicate EANs, not duplicate product titles.

---

## ✅ Improved Solution

### 1. Intelligent SKU Generation

**Strategy:** Generate SKUs from product attributes

```typescript
// Examples:
"Winter Coat" + "Black"        → WC-BLA
"Winter Coat" + "Red"          → WC-RED
"Summer Dress" + "Blue"        → SD-BLU
"Leather Jacket" + "Brown"     → LJ-BRO
"T-Shirt Basic" + "White"      → TSB-WHI

// With supplier prefix:
"SupplierA" + "Winter Coat" + "Black" → SA-WC-BLA
```

**Benefits:**
- ✅ Related variants have similar SKUs
- ✅ Human-readable and meaningful
- ✅ Consistent across imports
- ✅ Easy to identify product family

### 2. Product Matching Workflow

```
┌─────────────────────────────────────────────────────────┐
│  NEW CSV UPLOAD: "Winter Coat - Red"                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  STEP 1: Extract Base Title                             │
│  "Winter Coat - Red" → "Winter Coat" (remove color)     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Search Shopify for Existing Products           │
│  Query: title contains "Winter Coat"                    │
└─────────────────────────────────────────────────────────┘
                         ↓
                   ┌─────┴─────┐
                   │           │
           ┌───────▼────┐   ┌──▼──────┐
           │   FOUND    │   │ NOT FOUND│
           │  (exists)  │   │  (new)   │
           └───────┬────┘   └──┬───────┘
                   │           │
                   │           ↓
                   │    ┌──────────────────────────┐
                   │    │  CREATE NEW PRODUCT      │
                   │    │  Title: "Winter Coat"    │
                   │    │  Variant: Red            │
                   │    │  SKU: WC-RED             │
                   │    └──────────────────────────┘
                   │
                   ↓
         ┌──────────────────────────┐
         │  ADD VARIANT TO EXISTING │
         │  Product ID: gid://...   │
         │  New Variant: Red        │
         │  SKU: WC-RED             │
         └──────────────────────────┘
```

### 3. Complete Workflow Examples

#### Scenario A: First Import (Product doesn't exist)

**CSV Upload:**
```csv
Product Name,Color,Price,EAN
Winter Coat,Black,599,1234567890001
Winter Coat,Red,599,1234567890002
```

**Processing:**
1. Extract base title: "Winter Coat"
2. Search Shopify: No "Winter Coat" found
3. **Create NEW product** "Winter Coat" with 2 variants:
   - Black variant (SKU: WC-BLA, EAN: 1234567890001)
   - Red variant (SKU: WC-RED, EAN: 1234567890002)
4. Store `shopify_product_id` in database

**Result in Shopify:**
```
Product: Winter Coat (ID: gid://shopify/Product/123)
├─ Variant: Black (SKU: WC-BLA)
└─ Variant: Red   (SKU: WC-RED)
```

---

#### Scenario B: Subsequent Import (Product exists, adding new color)

**Previous State in Shopify:**
```
Product: Winter Coat (ID: gid://shopify/Product/123)
├─ Variant: Black (SKU: WC-BLA)
└─ Variant: Red   (SKU: WC-RED)
```

**New CSV Upload:**
```csv
Product Name,Color,Price,EAN
Winter Coat,Blue,599,1234567890003
```

**Processing:**
1. Extract base title: "Winter Coat"
2. Search Shopify: **FOUND** "Winter Coat" (ID: 123)
3. Check existing variants: Black, Red
4. **ADD NEW VARIANT** Blue to existing product
5. SKU follows pattern: WC-BLU

**Result in Shopify:**
```
Product: Winter Coat (ID: gid://shopify/Product/123)
├─ Variant: Black (SKU: WC-BLA)
├─ Variant: Red   (SKU: WC-RED)
└─ Variant: Blue  (SKU: WC-BLU)  ← NEW
```

---

#### Scenario C: Mixed Import (Some products exist, some don't)

**Previous State in Shopify:**
```
Product: Winter Coat (ID: 123)
└─ Variant: Black (SKU: WC-BLA)
```

**New CSV Upload:**
```csv
Product Name,Color,Price,EAN
Winter Coat,Red,599,1234567890002
Summer Dress,Blue,349,1234567890010
```

**Processing:**
1. **Row 1: "Winter Coat - Red"**
   - Base: "Winter Coat"
   - Found existing (ID: 123)
   - Add Red variant to existing (SKU: WC-RED)

2. **Row 2: "Summer Dress - Blue"**
   - Base: "Summer Dress"
   - NOT found in Shopify
   - Create new product (SKU: SD-BLU)

**Result in Shopify:**
```
Product: Winter Coat (ID: 123)         ← UPDATED
├─ Variant: Black (SKU: WC-BLA)
└─ Variant: Red   (SKU: WC-RED)        ← ADDED

Product: Summer Dress (ID: 456)        ← NEW
└─ Variant: Blue (SKU: SD-BLU)
```

---

## Implementation Details

### Phase 1: SKU Generation (✅ Created)

**File:** `server/utils/sku.ts`

Key functions:
```typescript
// Generate SKU from product attributes
generateSKU(baseTitle, color, supplier)

// Generate consistent SKUs for variant group
generateConsistentSKUs(products, supplier)

// Extract base title (remove color)
extractBaseTitle(title, color)

// Match products to existing Shopify products
matchToExistingProducts(newProducts, existingProducts)
```

### Phase 2: Product Matching (Next Step)

**File:** `server/routes/process.ts` (needs update)

```typescript
// Before processing products:
1. Query Shopify for existing products
2. Match new products to existing ones
3. Group: "Add as variant" vs "Create new"
4. Generate appropriate SKUs for each group
```

### Phase 3: Smart Import (Next Step)

**File:** `server/routes/import.ts` (needs update)

```typescript
// During import:
1. For products matched to existing:
   - Use productVariantsBulkCreate mutation
   - Add variants to existing product

2. For new products:
   - Use productCreate mutation
   - Create product with all variants
```

---

## Database Schema Enhancement

### Current Schema
```sql
CREATE TABLE products_queue (
  id SERIAL PRIMARY KEY,
  product_title VARCHAR(500),
  sku VARCHAR(100),
  color VARCHAR(100),
  parent_group_id VARCHAR(100),        -- Client-side grouping only
  shopify_product_id VARCHAR(255),     -- ✅ Added in fixes
  ...
);
```

### Recommended Addition
```sql
-- Add product matching fields
ALTER TABLE products_queue ADD COLUMN base_title VARCHAR(500);
ALTER TABLE products_queue ADD COLUMN product_identifier VARCHAR(32);
ALTER TABLE products_queue ADD COLUMN matched_shopify_product_id VARCHAR(255);

-- Index for faster matching
CREATE INDEX idx_products_queue_product_identifier ON products_queue(product_identifier);
CREATE INDEX idx_products_queue_base_title ON products_queue(base_title);
```

---

## Shopify API Usage

### Query Existing Products by Title

```graphql
query findProducts($query: String!) {
  products(first: 10, query: $query) {
    edges {
      node {
        id
        title
        variants(first: 100) {
          edges {
            node {
              id
              sku
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
    }
  }
}
```

**Usage:**
```typescript
const query = `title:"Winter Coat"`;
const response = await client.query({ data: { query: findProductsQuery, variables: { query } } });
```

### Add Variant to Existing Product

```graphql
mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkCreate(productId: $productId, variants: $variants) {
    productVariants {
      id
      sku
    }
    userErrors {
      field
      message
    }
  }
}
```

**Usage:**
```typescript
const variables = {
  productId: "gid://shopify/Product/123",
  variants: [
    {
      options: ["Blue"],
      price: "599.00",
      sku: "WC-BLU",
      barcode: "1234567890003"
    }
  ]
};
```

---

## Testing Scenarios

### Test 1: Sequential Imports of Same Product
```
Upload 1: Winter Coat - Black
  → Creates product, SKU: WC-BLA

Upload 2: Winter Coat - Red
  → Adds to existing, SKU: WC-RED ✓

Upload 3: Winter Coat - Blue
  → Adds to existing, SKU: WC-BLU ✓

Result: ONE product with 3 variants
```

### Test 2: Batch Import with Variants
```
CSV:
  Winter Coat, Black
  Winter Coat, Red
  Summer Dress, Blue

Result:
  - Winter Coat (2 variants: WC-BLA, WC-RED)
  - Summer Dress (1 variant: SD-BLU)
```

### Test 3: Supplier-Specific SKUs
```
Supplier A: Winter Coat - Black → SA-WC-BLA
Supplier B: Winter Coat - Black → SB-WC-BLA

Result: Two different products (different suppliers)
```

---

## Migration Path

### For Existing Data

**Option 1: Re-generate SKUs**
```sql
-- Update existing products with new SKU pattern
UPDATE products_queue
SET sku = generate_new_sku(product_title, color, supplier_name)
WHERE sku LIKE 'SKU%';
```

**Option 2: Keep Existing, Use New for Future**
- Existing products keep `SKU1001`, `SKU1002`, etc.
- New products use smart SKU generation
- Gradually migrate as products are re-imported

---

## Configuration Options

Add to `server/utils/constants.ts`:

```typescript
// SKU Generation Strategy
export const SKU_STRATEGY = {
  INCLUDE_SUPPLIER: true,          // Prefix with supplier code
  MAX_ACRONYM_LENGTH: 6,            // Max chars in product acronym
  MAX_COLOR_LENGTH: 3,              // Max chars in color code
  SEPARATOR: '-',                   // SKU separator
  PRESERVE_EXISTING: true,          // Keep non-sequential SKUs
};

// Product Matching
export const MATCHING_CONFIG = {
  SIMILARITY_THRESHOLD: 0.9,        // 90% similarity to match
  SEARCH_EXISTING_ON_IMPORT: true,  // Query Shopify before creating
  MAX_PRODUCTS_TO_SEARCH: 50,       // Limit search results
};
```

---

## Benefits Summary

| Feature | Before | After |
|---------|--------|-------|
| **SKU Pattern** | SKU1001, SKU1002 | WC-BLA, WC-RED |
| **Relationship** | No connection | Clear variant relationship |
| **Duplicate Products** | Creates duplicates | Adds to existing |
| **Import Intelligence** | Always create new | Smart detection |
| **Data Integrity** | Shopify gets messy | Clean product catalog |
| **Scalability** | 100 variants = 100 products | 100 variants = grouped properly |

---

## Recommendations

1. **Implement Phase 2 & 3** - Update process.ts and import.ts to use new SKU utilities
2. **Add Product Search** - Query Shopify for existing products before import
3. **Test Thoroughly** - Run test scenarios with existing data
4. **Document SKU Pattern** - Add to user documentation
5. **Add UI Indicator** - Show "Will add to existing product" vs "Will create new" in queue

---

This strategy ensures your Shopify store has a **clean, organized product catalog** with meaningful SKUs and proper variant grouping, regardless of when or how products are imported.
