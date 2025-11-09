# Code Review: Issues & Optimizations

Comprehensive review of the Shopify Product Import App codebase identifying bugs, security issues, performance problems, and UX improvements.

---

## 🚨 CRITICAL ISSUES (Must Fix Before Production)

### 1. **CORS Configuration Too Permissive** - SECURITY
**Location:** `server/index.ts:23`
```typescript
app.use(cors()); // ❌ Allows ALL origins
```
**Issue:** Allows requests from any domain, exposing app to CSRF attacks.

**Fix:**
```typescript
app.use(cors({
  origin: process.env.SHOPIFY_APP_URL || 'https://produktimport.wemarket.dk',
  credentials: true
}));
```

---

### 2. **No API Rate Limiting** - SECURITY
**Location:** All API endpoints
**Issue:** No protection against DoS attacks or API abuse.

**Fix:** Add express-rate-limit
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

### 3. **Memory Leak Risk with Large CSV Files** - PERFORMANCE
**Location:** `server/routes/upload.ts:30-34`
```typescript
const fileContent = readFileSync(req.file.path, 'utf-8'); // ❌ Loads entire file
const records = parse(fileContent, { ... });
```
**Issue:** 10MB CSV could have 100,000+ rows loaded into memory, crashing the server.

**Fix:** Stream parsing or chunk processing
```typescript
// Add file size check
if (req.file.size > 5 * 1024 * 1024) { // 5MB limit
  return res.status(413).json({ error: 'File too large. Max 5MB' });
}
```

---

### 4. **Missing Transaction Support** - DATA INTEGRITY
**Location:** `server/routes/process.ts:123-157`
**Issue:** Multiple database inserts without transaction. If one fails, partial data remains.

**Fix:** Wrap in transaction
```typescript
const client = await getClient();
try {
  await client.query('BEGIN');
  // ... all inserts
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

---

### 5. **CSV Content Not Validated** - SECURITY
**Location:** `server/routes/upload.ts:23-26`
**Issue:** Only checks file extension, not actual content. Could upload malicious files.

**Fix:**
```typescript
fileFilter: (req, file, cb) => {
  // Check MIME type
  if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
    cb(new Error('Only CSV files allowed'));
    return;
  }
  cb(null, true);
},
```

And validate content after reading:
```typescript
// Check for CSV bomb
if (records.length > 10000) {
  return res.status(413).json({ error: 'Too many rows. Max 10,000 products per upload' });
}
```

---

### 6. **Environment Variables Not Validated** - RELIABILITY
**Location:** `server/shopify/config.ts:5-9`
**Issue:** App starts even if required env vars are missing, crashes later.

**Fix:** Add startup validation
```typescript
// server/index.ts - at top
const requiredEnvVars = [
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'SHOPIFY_SCOPES',
  'HOST',
  'DATABASE_URL',
  'SESSION_SECRET'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});
```

---

### 7. **Session Secret Weakness** - SECURITY
**Location:** `.env.example:28`
**Issue:** No validation that SESSION_SECRET is strong enough.

**Fix:**
```typescript
// Validate session secret strength
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('❌ SESSION_SECRET must be at least 32 characters');
  process.exit(1);
}
```

---

## ⚠️ HIGH PRIORITY ISSUES

### 8. **Fragile Color Detection** - FUNCTIONALITY
**Location:** `server/routes/process.ts:98`
```typescript
const baseTitle = product.title.replace(/\s*(black|white|red|blue|green|yellow|pink|purple|grey|gray|brown|orange|beige|navy|cream)\s*/gi, '').trim();
```
**Issues:**
- Only matches 15 English colors
- Won't match "Navy Blue", "Dark Red", "Light Grey"
- Won't work for non-English stores
- Could remove color from product name incorrectly

**Fix:**
```typescript
// Option 1: Use the color field instead
const baseTitle = product.color
  ? product.title.replace(new RegExp(`\\s*${product.color}\\s*`, 'gi'), '').trim()
  : product.title;

// Option 2: More comprehensive color list
const colorPattern = /(black|white|red|blue|green|yellow|pink|purple|grey|gray|brown|orange|beige|navy|cream|maroon|olive|lime|aqua|teal|silver|fuchsia|magenta|violet|indigo|turquoise|tan|khaki|coral|salmon|burgundy|charcoal|ivory|pearl|jade|amber|rose|wine|chocolate)/gi;
```

---

### 9. **N+1 Query Problem** - PERFORMANCE
**Location:** `server/routes/process.ts:123-157`
**Issue:** Each product inserted individually in a loop.

**Fix:** Use bulk insert
```typescript
// Build values array for bulk insert
const productValues = processedProducts.map((p, idx) => {
  const offset = idx * 11;
  return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10}, $${offset+11})`;
}).join(',');

const flatParams = processedProducts.flatMap(p => [
  fileId, req.storeId, supplierName, p.title, p.price,
  p.ean, p.sku, p.color, JSON.stringify(p.imageUrls),
  p.description, p.parentGroupId
]);

const result = await query(
  `INSERT INTO products_queue (...) VALUES ${productValues} RETURNING id`,
  flatParams
);
```

---

### 10. **No Input Validation on Price** - DATA QUALITY
**Location:** `server/routes/process.ts:103`
```typescript
price: parseFloat(product.price) || 0, // ❌ Allows 0, negative, NaN
```
**Issue:** Invalid prices accepted (0, negative, non-numeric).

**Fix:**
```typescript
const price = parseFloat(product.price);
if (isNaN(price) || price < 0) {
  throw new Error(`Invalid price for product "${product.title}": ${product.price}`);
}
```

---

### 11. **AI Response Parsing Too Fragile** - RELIABILITY
**Location:** `server/routes/mapping.ts:100-106`
```typescript
const jsonMatch = aiResponse.match(/\{[\s\S]*\}/); // ❌ Fragile
```
**Issue:** Will break if AI returns markdown code blocks ```json {...} ```

**Fix:**
```typescript
let mappings;
try {
  // Try parsing directly first
  const parsed = JSON.parse(aiResponse);
  mappings = parsed.mappings || parsed;
} catch {
  // Try extracting from code block
  const codeBlockMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    mappings = JSON.parse(codeBlockMatch[1]).mappings;
  } else {
    // Try basic regex
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      mappings = JSON.parse(jsonMatch[0]).mappings;
    } else {
      throw new Error('No valid JSON found in AI response');
    }
  }
}
```

---

### 12. **No Retry Logic for External APIs** - RELIABILITY
**Location:** `server/routes/mapping.ts:79-93`, `server/routes/import.ts:147-152`
**Issue:** OpenRouter and Shopify API calls fail without retry on network errors.

**Fix:** Add retry with exponential backoff
```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

// Usage
const response = await retryWithBackoff(() =>
  axios.post('https://openrouter.ai/api/v1/chat/completions', {...})
);
```

---

### 13. **Missing Image URL Validation** - FUNCTIONALITY
**Location:** `server/routes/process.ts:90-95`
**Issue:** No validation that image URLs are valid URLs or accessible.

**Fix:**
```typescript
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

const imageUrls = [
  product.image_url_1,
  product.image_url_2,
  product.image_url_3,
].filter(url => url && isValidImageUrl(url));
```

---

### 14. **Parent Group ID Collisions** - FUNCTIONALITY
**Location:** `server/routes/process.ts:99`
```typescript
const parentGroupId = baseTitle.toLowerCase().replace(/\s+/g, '-');
```
**Issue:** Different products could get same ID ("Blue Coat" and "Coat" both become "coat").

**Fix:**
```typescript
// Include supplier or use hash
const parentGroupId = `${supplierName.toLowerCase().replace(/\s+/g, '-')}-${baseTitle.toLowerCase().replace(/\s+/g, '-')}`;

// Or use hash for uniqueness
import { createHash } from 'crypto';
const parentGroupId = createHash('md5')
  .update(`${supplierName}-${baseTitle}`)
  .digest('hex')
  .substring(0, 16);
```

---

## 📋 MEDIUM PRIORITY ISSUES

### 15. **No Shopify Product ID Stored** - FUNCTIONALITY
**Location:** `server/routes/import.ts:83-90`
**Issue:** After importing, we don't store the Shopify product ID. Can't update products later.

**Fix:** Add column to products_queue:
```sql
ALTER TABLE products_queue ADD COLUMN shopify_product_id VARCHAR(255);
CREATE INDEX idx_products_queue_shopify_id ON products_queue(shopify_product_id);
```

```typescript
// Store the ID after successful import
const shopifyProductId = response.body.data.productCreate.product.id;
await query(
  'UPDATE products_queue SET shopify_product_id = $1 WHERE id = $2',
  [shopifyProductId, product.id]
);
```

---

### 16. **Database Connection Pool Not Configured** - PERFORMANCE
**Location:** `server/db/index.ts:3-6`
**Issue:** Using default pool settings, might not handle concurrent requests well.

**Fix:**
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 20, // maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

---

### 17. **Missing Index on parent_group_id** - PERFORMANCE
**Location:** `server/db/schema.sql`
**Issue:** Querying by parent_group_id in products_queue is not indexed.

**Fix:**
```sql
CREATE INDEX IF NOT EXISTS idx_products_queue_parent_group ON products_queue(parent_group_id);
```

---

### 18. **Supplier Name Not Sanitized** - SECURITY
**Location:** `server/routes/upload.ts:48-52`
**Issue:** Supplier name could contain special characters, SQL injection attempts.

**Fix:**
```typescript
// Sanitize supplier name
const sanitizedSupplierName = supplierName.trim().replace(/[<>\"\']/g, '');
if (sanitizedSupplierName.length === 0) {
  return res.status(400).json({ error: 'Invalid supplier name' });
}
if (sanitizedSupplierName.length > 100) {
  return res.status(400).json({ error: 'Supplier name too long (max 100 chars)' });
}
```

---

### 19. **Error Messages Leak Information** - SECURITY
**Location:** Multiple files
**Issue:** Error messages expose database structure, internal paths.

**Fix:**
```typescript
// Generic error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);

  // Don't leak internal details
  const safeMessage = process.env.NODE_ENV === 'development'
    ? err.message
    : 'An error occurred. Please try again.';

  res.status(err.status || 500).json({
    error: safeMessage
  });
});
```

---

### 20. **No Cleanup of Old Sessions** - PERFORMANCE
**Location:** `server/db/schema.sql:60-69`
**Issue:** Sessions table grows forever, no expiry cleanup.

**Fix:** Add cleanup cron job
```typescript
// server/jobs/cleanup.ts
import { query } from '../db';

export async function cleanupExpiredSessions() {
  await query('DELETE FROM sessions WHERE expires < NOW()');
}

// Run every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
```

---

## 🎨 UX/UI ISSUES

### 21. **Auto-Reset Too Fast** - UX
**Location:** `src/pages/UploadPage.tsx:86-92`
```typescript
setTimeout(() => {
  setFile(null);
  setSupplierName('');
  setNotes('');
  setUploadData(null);
  setMappingStage('upload');
}, 3000); // ❌ Only 3 seconds to read success message
```
**Issue:** User barely has time to read the success message.

**Fix:**
```typescript
// Add "View Queue" button instead of auto-reset
<Button onClick={() => navigate('/queue')}>View Queue</Button>
// Or increase timeout to 10 seconds
```

---

### 22. **No Loading Indicator for AI Mapping** - UX
**Location:** `src/components/MappingReview.tsx:57-80`
**Issue:** While waiting for AI response, just shows skeleton. Should show progress.

**Fix:**
```typescript
{loading && (
  <Banner status="info">
    <Stack vertical>
      <Text>Analyzing your CSV columns with AI...</Text>
      <Text>This may take 10-30 seconds.</Text>
    </Stack>
  </Banner>
)}
```

---

### 23. **No Confirmation for Destructive Actions** - UX
**Location:** `src/pages/QueuePage.tsx` - Delete button
**Issue:** Delete button has no confirmation modal.

**Fix:** Add confirmation modal (similar to import modal).

---

### 24. **No File Size Limit Shown** - UX
**Location:** `src/pages/UploadPage.tsx:133-149`
**Issue:** User doesn't know the 10MB limit until upload fails.

**Fix:**
```typescript
<DropZone
  accept=".csv"
  type="file"
  onDrop={handleFileDrop}
>
  <DropZone.FileUpload
    actionHint="Accepts .csv files up to 10MB"
  />
</DropZone>
```

---

### 25. **Navigation Breaks During Processing** - UX
**Location:** `src/App.tsx`
**Issue:** User can navigate away during upload/processing, losing state.

**Fix:** Add navigation guard or persist state in localStorage.

---

### 26. **No Product Preview in Queue** - UX
**Location:** `src/pages/QueuePage.tsx`
**Issue:** Can't click product to see full details before importing.

**Fix:** Add onClick to ResourceItem to show modal with full product details.

---

## 🔧 CODE QUALITY ISSUES

### 27. **Excessive Use of `any` Type** - TYPE SAFETY
**Location:** Multiple files
**Issue:** TypeScript benefits lost with `any` everywhere.

**Examples:**
- `server/routes/process.ts:33` - `const product: any = {}`
- `server/routes/import.ts:53` - `const client = new shopify.clients.Graphql({ session: { accessToken: req.accessToken, shop: req.shop } as any })`

**Fix:** Define proper interfaces.

---

### 28. **Magic Numbers** - MAINTAINABILITY
**Location:** Multiple files
**Issue:** Hard-coded numbers with no explanation.

**Examples:**
- `server/routes/process.ts:55` - `let skuCounter = existingSKUs.maxCounter || 1000;`
- `server/routes/process.ts:195` - `for (let i = 0; i < eans.length; i += 50)`

**Fix:** Use named constants
```typescript
const INITIAL_SKU_COUNTER = 1000;
const SHOPIFY_QUERY_BATCH_SIZE = 50;
```

---

### 29. **No Logging Framework** - OPERATIONS
**Location:** All files use `console.log` / `console.error`
**Issue:** Inadequate for production. No structured logs, log levels, or persistence.

**Fix:** Use Winston or Pino
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

---

### 30. **Missing JSDoc Comments** - MAINTAINABILITY
**Location:** All complex functions
**Issue:** No documentation for functions, parameters, return values.

**Fix:** Add JSDoc
```typescript
/**
 * Checks for duplicate EANs in Shopify store
 * @param accessToken - Shopify access token
 * @param shop - Shop domain
 * @param eans - Array of EAN barcodes to check
 * @returns Array of EANs that already exist in Shopify
 */
async function checkDuplicateEANs(
  accessToken: string,
  shop: string,
  eans: string[]
): Promise<string[]> {
```

---

## 🚀 PERFORMANCE OPTIMIZATIONS

### 31. **Bundle Size Not Optimized** - PERFORMANCE
**Location:** `vite.config.ts`
**Issue:** No code splitting or chunk optimization.

**Fix:**
```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      output: {
        manualChunks: {
          'polaris': ['@shopify/polaris'],
          'vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
```

---

### 32. **No Caching for Shopify Queries** - PERFORMANCE
**Location:** `server/routes/process.ts:183-226`
**Issue:** Same EAN might be checked multiple times in different uploads.

**Fix:** Add Redis cache with short TTL
```typescript
// Cache EAN check results for 5 minutes
const cachedResult = await redis.get(`ean:${ean}`);
if (cachedResult) return JSON.parse(cachedResult);

// ... query Shopify
await redis.setex(`ean:${ean}`, 300, JSON.stringify(result));
```

---

### 33. **Uploaded Files Not Cleaned Up** - STORAGE
**Location:** `server/routes/upload.ts:103`
**Issue:** Files deleted immediately after processing, but `uploads/` directory never cleaned.

**Fix:** Already good! Files are deleted. Just ensure directory exists:
```bash
mkdir -p uploads
```

---

## 📱 DEPLOYMENT ISSUES

### 34. **No Database Migration Version Control** - OPERATIONS
**Location:** `server/migrations/run.ts`
**Issue:** No tracking of which migrations have run. Re-running could fail.

**Fix:** Use proper migration tool like `node-pg-migrate` or track versions:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 35. **No Health Check for Dependencies** - OPERATIONS
**Location:** `server/index.ts:28-30`
**Issue:** Health check doesn't verify database or external services.

**Fix:**
```typescript
app.get('/health', async (req, res) => {
  try {
    // Check database
    await query('SELECT 1');

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: process.env.npm_package_version
    });
  } catch (error) {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});
```

---

### 36. **Uploads Directory Not Created** - DEPLOYMENT
**Location:** `.gitignore` excludes `uploads/` but doesn't create it.
**Issue:** First upload will fail if directory doesn't exist.

**Fix:**
```typescript
// server/index.ts - on startup
import { mkdirSync } from 'fs';
mkdirSync('uploads', { recursive: true });
```

---

### 37. **No Rollback Strategy in GitHub Actions** - DEPLOYMENT
**Location:** `.github/workflows/deploy.yml`
**Issue:** If deployment fails partway, no automatic rollback.

**Fix:** Add rollback step
```yaml
- name: Rollback on failure
  if: failure()
  run: |
    ssh $GCP_USER@$GCP_HOST << 'ENDSSH'
      cd ~/shopify-product-import
      git checkout HEAD~1
      npm run build
      pm2 restart shopify-product-import
    ENDSSH
```

---

## 📊 MISSING MVP FEATURES

### 38. **No Way to Edit Queue Products** - FEATURE
**Issue:** Once in queue, can't edit title, price, or other fields.

**Fix:** Add edit endpoint and modal in QueuePage.

---

### 39. **Can't Re-import Failed Products** - FEATURE
**Issue:** If import fails, product marked as failed but no retry button.

**Fix:** Add status filter and "Retry Import" button.

---

### 40. **No Import History** - FEATURE
**Issue:** Can't see what was imported when, or link to Shopify products.

**Fix:** Add imported_products table (already in roadmap).

---

## 🏁 PRIORITY MATRIX

| Priority | Issue | Impact | Effort | Fix By |
|----------|-------|--------|--------|--------|
| P0 | CORS too permissive (#1) | High | Low | Pre-launch |
| P0 | No rate limiting (#2) | High | Low | Pre-launch |
| P0 | Memory leak (#3) | High | Medium | Pre-launch |
| P0 | No transactions (#4) | High | Medium | Pre-launch |
| P0 | CSV validation (#5) | High | Low | Pre-launch |
| P0 | Env validation (#6) | High | Low | Pre-launch |
| P1 | Color detection (#8) | Medium | Medium | Week 1 |
| P1 | N+1 queries (#9) | Medium | Medium | Week 1 |
| P1 | Price validation (#10) | Medium | Low | Week 1 |
| P1 | AI parsing (#11) | Medium | Low | Week 1 |
| P1 | Retry logic (#12) | Medium | Medium | Week 2 |
| P2 | Store Shopify ID (#15) | Low | Low | Week 2 |
| P2 | Connection pool (#16) | Low | Low | Week 2 |

---

## ✅ RECOMMENDED IMMEDIATE ACTIONS

1. **Fix all P0 issues** - Block deployment until done
2. **Add comprehensive tests** - Currently no tests exist
3. **Set up error monitoring** - Sentry or similar
4. **Add request logging** - Morgan + Winston
5. **Implement rate limiting** - Prevent abuse
6. **Add input validation library** - Joi or Zod
7. **Test with real CSV files** - Edge cases

---

## 📝 TESTING RECOMMENDATIONS

Currently **0 tests exist**. Need to add:

1. **Unit tests** for:
   - Color detection logic
   - Parent group ID generation
   - SKU generation
   - Price parsing

2. **Integration tests** for:
   - CSV upload flow
   - AI mapping
   - Product processing
   - Shopify import

3. **E2E tests** for:
   - Complete upload → import flow
   - Error handling scenarios

**Test framework setup:**
```bash
npm install --save-dev jest @types/jest ts-jest supertest
```

---

This review identified **40 issues** across security, performance, UX, and code quality. Fix P0 issues before launch, P1 within first week, P2 within first month.
