# Import Types Architecture

## Overview
The product import system supports three different import types, each with distinct behavior for how products are created, updated, or managed in Shopify.

## Product Matching Strategy

### SKU-Based Matching
**All product matching and comparison is done at the SKU level**, not by title.

```
Process Flow:
1. Extract SKU from CSV row
2. Search Shopify for product variant with matching SKU
3. If found → Product exists (update scenario)
4. If not found → New product (create scenario)
```

## Import Types

### 1. Normal (Default)

**Behavior:**
- If product exists (SKU match found):
  - **Full product update** - Update title, description, images, price, inventory, all fields
  - User can refresh all product data from supplier
- If product doesn't exist:
  - Create new product with all details

**Use Case:** Regular product catalog updates where supplier provides updated content

### 2. Preorder

**Behavior:**
- Check inventory level for the variant
- **If inventory = 0:**
  - Set metafield `pre_order` = `true`
  - Set metafield `pre_order_info` = Danish delivery date sentence
- **If inventory > 0:**
  - Import as normal product (no preorder metafields)

**Delivery Date Format (Danish):**
Three options:
- `"I starten af {måned}"` - Beginning of {month}
- `"I midten af {måned}"` - Middle of {month}
- `"I slutningen af {måned}"` - End of {month}

Example: `"I starten af december"`

**Metafields:**
```json
{
  "namespace": "custom",
  "key": "pre_order",
  "type": "boolean",
  "value": "true"
}
{
  "namespace": "custom",
  "key": "pre_order_info",
  "type": "single_line_text_field",
  "value": "I starten af december"
}
```

**Use Case:** Products that may be available now or coming soon

### 3. Inventory Change

**Behavior:**
- **Only update inventory levels**
- Do NOT modify:
  - Product title
  - Description
  - Images
  - Price
  - Variants (except inventory)
  - Any other product data

**Use Case:** Daily/weekly inventory synchronization without touching product content

## Database Schema Changes

### products_queue Table

Add new columns:
```sql
ALTER TABLE products_queue ADD COLUMN import_type VARCHAR(50) DEFAULT 'normal';
ALTER TABLE products_queue ADD COLUMN pre_order_timing VARCHAR(50);  -- 'start', 'middle', 'end'
ALTER TABLE products_queue ADD COLUMN pre_order_month VARCHAR(50);   -- 'januar', 'februar', etc.
ALTER TABLE products_queue ADD COLUMN inventory_quantity INTEGER DEFAULT 0;

-- Create index for SKU-based lookups
CREATE INDEX idx_products_queue_sku ON products_queue(sku);
```

### sessions Table

Add import type preference:
```sql
ALTER TABLE sessions ADD COLUMN import_type_preference VARCHAR(50) DEFAULT 'normal';
```

## Implementation Changes

### 1. Process Route (server/routes/process.ts)

**Current:** Title-based product matching
**New:** SKU-based product matching

```typescript
// OLD (Title-based)
const existingProducts = await searchShopifyProducts(
  accessToken,
  shop,
  baseTitle
);

// NEW (SKU-based)
const existingVariant = await searchShopifyProductBySKU(
  accessToken,
  shop,
  product.sku
);
```

**Steps:**
1. Extract SKU from CSV
2. Search Shopify for variant with matching SKU
3. Set `import_action`:
   - `create_new` - SKU not found
   - `update_existing` - SKU found
4. Store `import_type` from user selection
5. Store preorder timing/month if type is 'preorder'

### 2. Import Route (server/routes/import.ts)

**Current:** Create new or add variant
**New:** Create, update, or inventory-only based on import_type

```typescript
// Group by import type AND action
const toCreate = products.filter(p => p.importAction === 'create_new');
const toUpdateFull = products.filter(p =>
  p.importAction === 'update_existing' &&
  p.importType === 'normal'
);
const toUpdateInventoryOnly = products.filter(p =>
  p.importAction === 'update_existing' &&
  p.importType === 'inventory_change'
);
const toHandlePreorder = products.filter(p =>
  p.importType === 'preorder'
);
```

**Preorder Logic:**
```typescript
async function handlePreorderProduct(product: QueueProduct) {
  if (product.inventoryQuantity === 0) {
    const preOrderInfo = generatePreOrderInfo(
      product.preOrderTiming,
      product.preOrderMonth
    );

    await updateProductMetafields(product.matchedShopifyProductId, [
      { namespace: 'custom', key: 'pre_order', type: 'boolean', value: 'true' },
      { namespace: 'custom', key: 'pre_order_info', type: 'single_line_text_field', value: preOrderInfo }
    ]);
  }

  // Update inventory regardless
  await updateVariantInventory(product.matchedShopifyVariantId, product.inventoryQuantity);
}
```

### 3. Shopify Helpers (server/utils/shopify-helpers.ts)

Add new functions:
```typescript
// Search by SKU instead of title
export async function searchShopifyProductBySKU(
  accessToken: string,
  shop: string,
  sku: string
): Promise<ShopifyVariant | null>

// Update full product
export async function updateShopifyProduct(
  accessToken: string,
  shop: string,
  productId: string,
  updates: ProductUpdateInput
): Promise<void>

// Update inventory only
export async function updateVariantInventory(
  accessToken: string,
  shop: string,
  variantId: string,
  inventoryQuantity: number
): Promise<void>

// Update product metafields
export async function updateProductMetafields(
  accessToken: string,
  shop: string,
  productId: string,
  metafields: Array<{namespace: string, key: string, type: string, value: string}>
): Promise<void>
```

## UI Changes

### Column Mapping Screen

Add import type selector:
```tsx
<Select
  label="Import Type"
  options={[
    {label: 'Normal - Create/Update Full Product', value: 'normal'},
    {label: 'Preorder - Handle Stock Availability', value: 'preorder'},
    {label: 'Inventory Change - Only Update Stock', value: 'inventory_change'}
  ]}
  value={importType}
  onChange={setImportType}
/>
```

### Preorder Configuration (shown if type = 'preorder')
```tsx
<Select
  label="Delivery Timing"
  options={[
    {label: 'I starten af', value: 'start'},
    {label: 'I midten af', value: 'middle'},
    {label: 'I slutningen af', value: 'end'}
  ]}
  value={preOrderTiming}
  onChange={setPreOrderTiming}
/>

<Select
  label="Month"
  options={danishMonths}
  value={preOrderMonth}
  onChange={setPreOrderMonth}
/>
```

## Example Scenarios

### Scenario 1: Normal Import - New Product
```
CSV: SKU=ABC123, Title="Blue Shirt", Price=299, Inventory=50
Shopify: SKU not found
Action: Create new product "Blue Shirt" with variant SKU=ABC123
Result: New product created
```

### Scenario 2: Normal Import - Update Existing
```
CSV: SKU=ABC123, Title="Blue Shirt (Updated)", Price=349, Inventory=75
Shopify: SKU=ABC123 found (Product ID: 123)
Action: Update product 123 - change title, price, inventory
Result: Product fully updated with new data
```

### Scenario 3: Inventory Change
```
CSV: SKU=ABC123, Inventory=100
Shopify: SKU=ABC123 found (Variant ID: 456)
Action: Update only inventory for variant 456
Result: Inventory changed to 100, all other fields unchanged
```

### Scenario 4: Preorder - Out of Stock
```
CSV: SKU=ABC123, Inventory=0, Type=Preorder, Timing=start, Month=december
Shopify: SKU=ABC123 found
Action: Set pre_order=true, pre_order_info="I starten af december", inventory=0
Result: Product marked as preorder with delivery info
```

### Scenario 5: Preorder - In Stock
```
CSV: SKU=ABC123, Inventory=25, Type=Preorder
Shopify: SKU=ABC123 found
Action: Update inventory=25, remove preorder metafields (if present)
Result: Normal product with stock
```

## Migration Path

1. **Database Migration** - Add new columns
2. **Update Shopify Helpers** - Add SKU search and update functions
3. **Update Process Route** - Change to SKU-based matching
4. **Update Import Route** - Implement three import type handlers
5. **Update UI** - Add import type selector and preorder config
6. **Testing** - Test all 5 scenarios above

## Benefits

1. **SKU-based matching** - More reliable than title matching
2. **Flexible import types** - Different workflows for different needs
3. **Preorder handling** - Automatic metafield management
4. **Inventory-only updates** - Fast daily stock syncs
5. **Full product updates** - Refresh all content when needed
