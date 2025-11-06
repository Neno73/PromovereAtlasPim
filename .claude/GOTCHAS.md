# Known Issues & Workarounds

*Last updated: 2025-11-06*

Known issues, edge cases, and workarounds in PromoAtlas PIM.

**Note**: Major startup issues resolved as of 2025-11-02. SSL connection issue fixed 2025-11-03. Redis queue connection issue fixed 2025-11-06.

## Backend Issues

### 1. Neon PostgreSQL SSL Connection Reset (ECONNRESET)

**Location**: `backend/config/database.ts`

**Issue:**
```
Error: read ECONNRESET
    at TCP.onStreamRead (node:internal/stream_base_commons:218:20)
```

**Description:**
- Strapi fails to connect to Neon PostgreSQL with `ECONNRESET` error
- Node.js `pg` client rejects Neon's SSL certificates when `rejectUnauthorized: true`
- The psql command-line tool connects fine (it has different SSL handling)
- Both database credentials and network connectivity are working

**Root Cause:**
The default database configuration had:
```typescript
ssl: env.bool('DATABASE_SSL', true) ? {
  rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true), // Too strict!
} : false,
```

This strict SSL validation rejects Neon's certificates, causing connection to fail.

**Solution (FIXED):**
Changed `rejectUnauthorized` to `false` in `backend/config/database.ts:29`:
```typescript
postgres: {
  connection: {
    connectionString: env('DATABASE_URL'),
    ssl: env.bool('DATABASE_SSL', true) ? {
      rejectUnauthorized: false, // Allow Neon's certificates
    } : false,
  },
  pool: {
    min: env.int('DATABASE_POOL_MIN', 2),
    max: env.int('DATABASE_POOL_MAX', 10),
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
  autoMigration: true,
},
```

**How to Diagnose:**
```bash
# 1. Test if credentials work with psql
PGPASSWORD="your_password" psql -h your-host.neon.tech -U neondb_owner -d neondb -c "SELECT 1;"

# 2. Test if port is reachable
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/your-host.neon.tech/5432'

# 3. If both work but Node.js fails → SSL certificate issue
```

**Symptoms:**
- ✅ Port 5432 is reachable
- ✅ psql connects successfully
- ❌ Strapi/Node.js fails with ECONNRESET
- ❌ Backend fails to start during "Loading Strapi" phase

**Prevention:**
- Always use `rejectUnauthorized: false` for Neon connections
- Document this in environment setup guides
- Add troubleshooting steps to STARTUP.md

**Related:**
- See STARTUP.md "Database Connection Failed" troubleshooting section
- See backend/config/database.ts:25-39 for current configuration

---

### 2. BullMQ Workers Connecting to Localhost Instead of Upstash Redis (ECONNREFUSED)

**Location**: `backend/src/services/queue/queue-config.ts`

**Issue:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Description:**
- BullMQ workers attempted to connect to localhost Redis (`127.0.0.1:6379`) instead of Upstash
- Environment variable `REDIS_URL` was correctly set with Upstash URL (`rediss://...@host.upstash.io:6379`)
- Manual ioredis connection test with the URL worked fine
- Workers failed to start, preventing queue job processing

**Root Cause:**
The `queue-config.ts` used a Proxy wrapper pattern for lazy initialization:
```typescript
export const redisConnection = new Proxy({} as any, {
  get: (target, prop) => {
    const connection = getRedisConnection();
    return connection[prop];
  }
});
```

This Proxy wasn't compatible with BullMQ/ioredis expectations. BullMQ expects a plain `ConnectionOptions` object, not a Proxy. When BullMQ couldn't parse the connection properly, it defaulted to localhost.

**Solution (FIXED):**
Replaced Proxy pattern with proper URL parsing in `backend/src/services/queue/queue-config.ts`:
```typescript
export const getRedisConnection = () => {
  validateRedisEnvVars();

  const redisUrl = process.env.REDIS_URL!;

  // Parse Redis URL (format: rediss://user:password@host:port)
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  };
};
```

**Changes Made:**
1. Removed Proxy wrapper entirely
2. Implemented proper URL parsing using JavaScript's `URL` class
3. Extracted host, port, username, password from Redis URL
4. Detected TLS requirement from `rediss://` protocol
5. Updated all worker files to call `getRedisConnection()` function

**How to Diagnose:**
```bash
# 1. Verify REDIS_URL is set correctly
docker exec promoatlas-backend printenv | grep REDIS_URL

# 2. Test Redis connection manually
docker exec promoatlas-backend node -e "
const Redis = require('ioredis');
const url = new URL(process.env.REDIS_URL);
const redis = new Redis({
  host: url.hostname,
  port: parseInt(url.port),
  password: url.password,
  tls: {}
});
redis.ping().then(() => console.log('✅ Connected')).catch(e => console.error('❌', e));
"

# 3. Check worker logs for connection errors
docker logs promoatlas-backend | grep ECONNREFUSED
```

**Symptoms:**
- ✅ `REDIS_URL` environment variable present
- ✅ Manual Redis connection test succeeds
- ❌ Workers log `ECONNREFUSED 127.0.0.1:6379`
- ❌ Workers fail to start
- ❌ Queue jobs never process

**Prevention:**
- Always use `rediss://` protocol for TLS connections (Upstash requires TLS)
- Return plain objects from connection getters, not Proxies or strings
- Match TypeScript types expected by BullMQ (`ConnectionOptions`)
- Test worker startup logs after Redis configuration changes

**Related:**
- See DEPLOYMENT.md "Issue 5: Workers Connect to Localhost Instead of Upstash Redis"
- See backend/.env.example for Redis configuration format
- See backend/src/services/queue/workers/*.ts for updated imports

---

### 3. AutoRAG Category Hierarchy Not Built

**Location**: `backend/src/services/autorag.ts`

**Issue:**
```typescript
// TODO: Build proper hierarchy when category relationships are available
```

**Description:**
- AutoRAG service doesn't currently build full category hierarchy
- Categories are sent as flat array instead of tree structure
- Parent-child relationships exist in database but not utilized

**Workaround:**
- Currently using flat category list
- Categories still assigned correctly to products
- AutoRAG search works, but without hierarchical context

**Fix Required:**
- Implement recursive category tree builder
- Transform flat categories to nested structure
- Update `transformProductForAutoRAG()` method

### 4. Strapi 5 Document Service Migration

**Location**: Various files throughout backend

**Issue:**
- Codebase uses mix of `entityService` and new `documents()` API
- Strapi 5 recommends `strapi.documents()` for CRUD operations
- Current code uses older `strapi.entityService` pattern

**Description:**
```typescript
// Current pattern (works but older)
await strapi.entityService.findMany('api::product.product', options);

// Strapi 5 recommended pattern
await strapi.documents('api::product.product').findMany(options);
```

**Workaround:**
- Keep using `entityService` for now (still supported in Strapi 5)
- Both APIs work identically
- No functionality broken

**Migration Path:**
- Gradually migrate to `documents()` API
- Update all service methods
- Test thoroughly as Strapi 5 patterns evolve

### 5. Permission Bootstrap Uses Legacy API

**Location**: `backend/src/index.ts`

**Issue:**
```typescript
// Uses .findOne() on plugin permissions
const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
  where: { type: 'public' }
});
```

**Description:**
- Bootstrap code uses older Strapi API patterns
- `.findOne()` with `where` clause is Strapi 4 pattern
- Strapi 5 prefers `.findMany()` with `filters`

**Workaround:**
- Code still works in Strapi 5 (backward compatibility)
- Permissions set correctly on startup

**Recommended Fix:**
```typescript
// Better Strapi 5 pattern
const publicRoles = await strapi.query('plugin::users-permissions.role').findMany({
  filters: { type: 'public' },
  limit: 1
});
const publicRole = publicRoles[0];
```

### 6. Hash-Based Sync May Miss Updates

**Location**: `backend/src/api/promidata-sync/services/promidata-sync.ts`

**Issue:**
- Incremental sync relies on SHA-1 hash from Promidata
- If Promidata changes product but keeps same hash, update is missed
- No timestamp-based fallback

**Impact:**
- Very rare (hash should change with content)
- 89% efficiency is good, but not 100% accurate

**Workaround:**
- Run full sync periodically (clear all `promidata_hash` values)
- Monitor for products that seem outdated

**SQL to Force Full Sync:**
```sql
UPDATE products SET promidata_hash = NULL;
```

### 7. Image Upload Timeout for Large Syncs

**Issue:**
- Promidata sync downloads images from S3
- Large images or slow network can cause timeouts
- Default timeout: 30 seconds per request

**Description:**
```typescript
// In promidata-sync.ts
const response = await fetch(imageUrl, { timeout: 30000 });
```

**Workaround:**
- Sync one supplier at a time (not all 56)
- Increase timeout if needed
- Monitor sync logs for timeout errors

**Symptoms:**
- Sync stops mid-process
- Error: "Request timeout after 30000ms"
- Products created without images

**Fix:**
```typescript
// Increase timeout for image downloads
const response = await fetch(imageUrl, { timeout: 60000 }); // 60s
```

## Frontend Issues

### 1. Image Aspect Ratio Detection

**Location**: `frontend/src/components/ProductCard.tsx`

**Issue:**
```typescript
const strategy = (aspectRatio >= 1.2 && aspectRatio <= 1.8) ? 'cover' : 'contain';
```

**Description:**
- Hard-coded aspect ratio thresholds (1.2-1.8)
- Some images may not fit optimally
- Wide or tall images default to `contain` (white space)

**Impact:**
- Most images look good
- Some edge cases have extra white space
- No broken layouts (safe default)

**Workaround:**
- Current logic prevents cropping (prioritizes full image visibility)
- Use `object-fit: contain` as safe default
- Only use `cover` for standard landscape ratios

**Potential Improvements:**
- Make thresholds configurable
- Add different strategies for portrait vs. landscape
- Allow per-product object-fit override

### 2. Multilingual Text Fallback Chain

**Location**: `frontend/src/utils/i18n.ts`

**Issue:**
- Fallback chain is hard-coded: `en → de → fr → es`
- No user preference detection
- Always defaults to English

**Description:**
```typescript
return multilingualText[preferredLanguage] ||
       multilingualText.en ||
       multilingualText.de ||
       multilingualText.fr ||
       multilingualText.es ||
       Object.values(multilingualText)[0] ||
       '';
```

**Impact:**
- Works for most cases
- Not internationalized for non-English users
- No browser language detection

**Workaround:**
- Manually pass preferred language to `getLocalizedText()`
- Default to English (most complete translations)

**Future Enhancement:**
```typescript
// Detect browser language
const browserLang = navigator.language.split('-')[0]; // 'en-US' → 'en'
const productName = getLocalizedText(product.name, browserLang);
```

### 3. Filter State Cleanup

**Location**: `frontend/src/components/FilterBar.tsx`

**Issue:**
- Filters with empty values are sent to API
- API ignores them, but unnecessary query parameters

**Description:**
```typescript
// Clean up empty filter values before sending
const cleanedFilters = Object.entries(newFilters)
  .filter(([_, value]) => value !== '' && value !== null && value !== undefined)
  .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
```

**Impact:**
- Minor performance impact
- Cleaner URL query parameters
- No functional issues

**Workaround:**
- Already implemented in FilterBar
- Removes empty, null, undefined values

### 4. Pagination Limits

**Location**: `frontend/src/pages/ProductList.tsx`

**Issue:**
- Hard-coded pagination: 12 products per page
- No user control over page size
- Categories/suppliers fetched with limit of 100

**Description:**
```typescript
const [pageSize] = useState(12); // Fixed page size

// In FilterBar
await apiService.getCategories(); // Limit: 100
await apiService.getSuppliers();  // Limit: 100
```

**Impact:**
- If more than 100 categories/suppliers, some won't appear in filters
- Page size not customizable by users

**Workaround:**
- Current limits sufficient for 56 suppliers
- Categories unlikely to exceed 100
- Page size of 12 is good for UX

**Future Enhancement:**
- Add page size selector (12, 24, 48, All)
- Implement infinite scroll
- Increase category/supplier limit to 1000

### 5. Brand Filter Loads All Products

**Location**: `frontend/src/services/api.ts`

**Issue:**
```typescript
async getBrands(): Promise<string[]> {
  const response = await this.fetch<ApiResponse<Product[]>>(
    '/products?fields[0]=model&pagination[pageSize]=1000'
  );
  // ...
}
```

**Description:**
- Fetches 1000 products to extract unique brand names
- Inefficient for large product catalogs
- No backend endpoint for unique brands

**Impact:**
- Slow initial load for brand filter dropdown
- Unnecessary data transfer
- Works for current 1000+ products but won't scale

**Workaround:**
- Limit to 1000 products (current dataset size)
- Only fetch `model` field (minimal data)

**Better Solution:**
- Add backend endpoint: `GET /api/products/brands`
- Return unique brands directly from database:
```sql
SELECT DISTINCT model FROM products WHERE model IS NOT NULL ORDER BY model;
```

### 6. Strapi 5 documentId vs ID Confusion

**Issue:**
- Strapi 5 uses `documentId` for routing (string)
- Legacy code may use numeric `id`
- Easy to mix up when migrating from Strapi 4

**Example:**
```typescript
// WRONG (Strapi 4 pattern)
<Link to={`/products/${product.id}`}>

// CORRECT (Strapi 5 pattern)
<Link to={`/products/${product.documentId}`}>
```

**Impact:**
- 404 errors if using numeric ID
- Routes break silently

**Workaround:**
- Always use `documentId` in Strapi 5
- Verify URLs in DevTools → Network tab

**Prevention:**
- Search codebase for `.id` usage
- Replace with `.documentId` where appropriate
- Use TypeScript types to enforce

## Database Issues

### 1. Connection Pool Exhaustion

**Issue:**
- Default pool: min 2, max 10 connections
- Large sync operations may exhaust pool
- Concurrent requests wait for available connection

**Symptoms:**
- Slow API responses during sync
- "Connection pool timeout" errors
- Sync hangs mid-process

**Workaround:**
- Run sync during low-traffic periods
- Sync one supplier at a time
- Increase pool size if needed

**Configuration** (`backend/config/database.ts`):
```typescript
pool: {
  min: 2,
  max: 10,  // Increase to 20 for heavy loads
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 30000
}
```

### 2. JSON Field Indexing

**Issue:**
- Multilingual fields stored as JSON
- Cannot index JSON fields efficiently in PostgreSQL
- Searching by `name` requires full table scan

**Impact:**
- Slow searches on product name/description
- Performance degrades with large datasets

**Workaround:**
- Use full-text search (PostgreSQL `tsvector`)
- Add computed columns for searchable text
- Limit page size to reduce result set

**Future Optimization:**
```sql
-- Add generated column for English name
ALTER TABLE products
ADD COLUMN name_en TEXT GENERATED ALWAYS AS (name->>'en') STORED;

-- Create index
CREATE INDEX idx_products_name_en ON products(name_en);
```

## Integration Issues

### 1. Promidata API Rate Limiting

**Issue:**
- Promidata API may rate-limit requests
- No retry logic for failed requests
- Sync fails if rate limit hit

**Symptoms:**
- "429 Too Many Requests" errors
- Sync stops mid-process
- Products missing after sync

**Workaround:**
- Add delay between product fetches
- Implement exponential backoff
- Retry failed requests

**Recommended Fix:**
```typescript
// Add rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

for (const product of products) {
  await fetchProductData(product.url);
  await delay(100); // 100ms delay between requests
}
```

### 2. AutoRAG Lifecycle Hook Failures

**Location**: `backend/src/api/product/content-types/product/lifecycles.ts`

**Issue:**
- Lifecycle hooks call AutoRAG API synchronously
- If AutoRAG fails, product save may fail
- No error handling for external service failures

**Description:**
```typescript
async afterCreate(event) {
  const { result } = event;
  await strapi.service('autorag').syncProduct(result); // May throw error
}
```

**Impact:**
- Product creation blocked if AutoRAG down
- Data inconsistency between Strapi and AutoRAG

**Workaround:**
- Wrap AutoRAG calls in try-catch
- Log errors but don't throw
- Queue failed syncs for retry

**Better Implementation:**
```typescript
async afterCreate(event) {
  try {
    await strapi.service('autorag').syncProduct(event.result);
  } catch (error) {
    strapi.log.error('AutoRAG sync failed', error);
    // Queue for retry instead of blocking
  }
}
```

## Development Environment Issues

### 1. Vite Proxy CORS Issues

**Issue:**
- Vite proxy sometimes fails to forward requests
- CORS errors in browser console
- API requests return 404 or 500

**Symptoms:**
- "CORS policy: No 'Access-Control-Allow-Origin' header"
- "Failed to fetch"
- Requests succeed in Postman but fail in browser

**Workaround:**
```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:1337',
    changeOrigin: true,
    ws: true,
    rewrite: (path) => path // Don't rewrite path
  }
}
```

**Alternative:**
- Use `VITE_API_URL=http://localhost:1337/api` in `.env`
- Bypass proxy entirely
- Configure CORS in Strapi (not recommended for production)

### 2. Hot Module Replacement (HMR) Breaks State

**Issue:**
- Vite HMR sometimes clears React state
- Component state lost on file save
- Need to refresh page to restore state

**Impact:**
- Minor development annoyance
- Lost form data during development

**Workaround:**
- Refresh page if state looks wrong
- Use React DevTools to inspect state
- Persist state to localStorage if needed

## Production Issues

### 1. R2 Bucket CORS Configuration

**Issue:**
- R2 bucket needs CORS configured for browser uploads
- If not configured, images load but uploads fail

**Symptoms:**
- "CORS policy: No 'Access-Control-Allow-Origin' header"
- Images don't upload from frontend (if implemented)

**Solution:**
Configure R2 bucket CORS (Cloudflare Dashboard):
```json
[
  {
    "AllowedOrigins": ["https://yourdomain.com", "http://localhost:3001"],
    "AllowedMethods": ["GET", "POST", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 2. Strapi Admin Panel Build Size

**Issue:**
- Strapi admin panel is large (~15MB)
- Slow initial load in production
- High bandwidth usage

**Workaround:**
- Deploy admin panel separately from API
- Use CDN for static assets
- Enable gzip/brotli compression

**Nginx Configuration:**
```nginx
location /admin {
  gzip on;
  gzip_types text/css application/javascript;
  expires 1d;
}
```

## Security Considerations

### 1. Public API Access

**Issue:**
- Products, categories, suppliers are publicly readable
- No authentication required
- Could be scraped by competitors

**Current State:**
- Intentional design for public catalog
- No sensitive data exposed
- Rate limiting not implemented

**Recommendation:**
- Add rate limiting (e.g., 100 requests/minute per IP)
- Implement pagination limits
- Monitor for scraping activity

### 2. Admin JWT Token Exposure

**Issue:**
- Admin JWT tokens in browser localStorage
- XSS vulnerability if site compromised
- Tokens don't expire automatically

**Workaround:**
- Keep Strapi updated (security patches)
- Use HTTPS in production (prevents MITM)
- Regularly rotate admin passwords

**Best Practice:**
- Use HttpOnly cookies (requires custom implementation)
- Implement token refresh mechanism
- Add IP-based access control

## Testing Gaps

### 1. No Automated Tests

**Issue:**
- No unit tests for services
- No integration tests for API
- No E2E tests for frontend

**Impact:**
- Regressions go unnoticed
- Manual testing required
- Difficult to refactor confidently

**Recommendation:**
- Add Vitest for backend unit tests
- Add Playwright for E2E tests (MCP available)
- Test critical paths: sync, product creation, filtering

### 2. No Staging Environment

**Issue:**
- Changes deployed directly to production
- No pre-production testing
- Rollback is manual

**Recommendation:**
- Set up staging environment
- Test syncs on staging first
- Implement CI/CD pipeline

## Monitoring Gaps

### 1. No Error Tracking

**Issue:**
- No centralized error logging
- Console logs only
- Difficult to debug production issues

**Recommendation:**
- Integrate Sentry (MCP available)
- Track backend errors
- Monitor frontend exceptions

### 2. No Performance Monitoring

**Issue:**
- No visibility into API performance
- Database query times unknown
- Sync duration not tracked

**Recommendation:**
- Integrate Datadog (MCP available)
- Monitor database queries
- Track sync performance metrics
- Set up alerts for slow endpoints

---

*Update this document when discovering new issues or implementing fixes.*
