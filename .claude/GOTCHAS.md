# Known Issues & Workarounds

*Last updated: 2025-12-05*

Known issues and workarounds in PromoAtlas PIM. **Fixed issues archived.**

## Gemini FileSearchStore Issues

### 1. FileSearchStore vs Files API Namespace Confusion

**Location**: `backend/src/api/gemini-sync/services/gemini-file-search.ts`

**Issue**:
```
Files uploaded to FileSearchStore are NOT visible via files.list()
```

**Description**:
- Gemini has TWO separate namespaces for files
- `ai.files.list()` → Default Files API (uploads here are NOT searchable)
- `ai.fileSearchStores.uploadFile()` → FileSearchStore (uploads here ARE searchable)
- Files uploaded to FileSearchStore do NOT appear in `files.list()` results

**Impact**:
- Scripts using `files.list()` report 0 files when files exist
- Debugging tools show "empty" when store has content
- Confusion about whether sync is working

**Verification**:
Use semantic search to verify files exist (not `files.list()`):
```typescript
const response = await client.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: 'Show me chewing gum products',
  config: {
    tools: [{
      fileSearch: {
        fileSearchStoreNames: [storeId]  // ✅ Correct format
      }
    }]
  }
});
```

**Key Insight**: If the AI can find products via semantic search, files ARE uploaded correctly.

---

### 2. FileSearchStore Does NOT Support Individual File Deletion

**Location**: `backend/src/api/gemini-sync/services/gemini-file-search.ts`

**Issue**:
```
Individual files cannot be deleted from FileSearchStore
```

**Description**:
- FileSearchStore API only supports deleting the ENTIRE store
- No API exists to delete individual files
- This means deduplication via delete-then-upload is impossible

**Impact**:
- Files accumulate in the store over time
- Re-syncing a product adds a new file (doesn't replace)
- Storage grows with each sync cycle

**Current Workaround**:
- Accept file accumulation (semantic search still works)
- Track sync status in Strapi via `gemini_file_uri` field
- Consider periodic store recreation for cleanup (requires full re-sync)

**Tracking Pattern**:
```typescript
// After upload, save to Strapi
await strapi.entityService.update('api::product.product', documentId, {
  data: { gemini_file_uri: operation.name }
});

// To "delete" (just clears tracking, file remains in store)
await strapi.entityService.update('api::product.product', documentId, {
  data: { gemini_file_uri: null }
});
```

---

### 3. Wrong API Format for FileSearch Queries

**Location**: Any code querying FileSearchStore

**Issue**:
```typescript
// ❌ WRONG - Uses fileSearchStoreIds (won't find files)
tools: [{ fileSearch: { fileSearchStoreIds: [storeId] } }]

// ✅ CORRECT - Uses fileSearchStoreNames
config: { tools: [{ fileSearch: { fileSearchStoreNames: [storeId] } }] }
```

**Description**:
- API format differs between documentation versions
- `fileSearchStoreIds` is NOT the correct parameter
- Must use `fileSearchStoreNames` inside `config.tools`

**Impact**:
- Queries return no results even when files exist
- AI responds with "I don't have access to product catalog"

**Solution**:
Always use this format for FileSearch queries:
```typescript
const response = await client.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: prompt,
  config: {
    tools: [{
      fileSearch: {
        fileSearchStoreNames: [storeId]
      }
    }]
  }
});
```

---

## Backend Issues

### 1. Hash-Based Sync May Miss Updates

**Location**: `backend/src/api/promidata-sync/services/promidata-sync.ts`

**Issue**:
- Incremental sync relies on SHA-1 hash from Promidata
- If Promidata changes product but keeps same hash, update is missed
- No timestamp-based fallback

**Impact**:
- Very rare (hash should change with content)
- 89% efficiency is good, but not 100% accurate

**Workaround**:
- Run full sync periodically (clear all `promidata_hash` values)
- Monitor for products that seem outdated

**SQL to Force Full Sync**:
```sql
UPDATE products SET promidata_hash = NULL;
```

---

### 2. Image Upload Timeout for Large Syncs

**Issue**:
- Promidata sync downloads images from S3
- Large images or slow network can cause timeouts
- Default timeout: 30 seconds per request

**Workaround**:
- Sync one supplier at a time (not all 56)
- Increase timeout if needed
- Monitor sync logs for timeout errors

**Symptoms**:
- Sync stops mid-process
- Error: "Request timeout after 30000ms"
- Products created without images

**Fix**:
```typescript
// Increase timeout for image downloads
const response = await fetch(imageUrl, { timeout: 60000 }); // 60s
```

---

### 3. Connection Pool Exhaustion

**Issue**:
- Default pool: min 2, max 10 connections
- Large sync operations may exhaust pool
- Concurrent requests wait for available connection

**Symptoms**:
- Slow API responses during sync
- "Connection pool timeout" errors
- Sync hangs mid-process

**Workaround**:
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

---

### 4. JSON Field Indexing

**Issue**:
- Multilingual fields stored as JSON
- Cannot index JSON fields efficiently in PostgreSQL
- Searching by `name` requires full table scan

**Impact**:
- Slow searches on product name/description
- Performance degrades with large datasets

**Workaround**:
- Use full-text search (PostgreSQL `tsvector`)
- Add computed columns for searchable text
- Limit page size to reduce result set

**Future Optimization**:
```sql
-- Add generated column for English name
ALTER TABLE products
ADD COLUMN name_en TEXT GENERATED ALWAYS AS (name->>'en') STORED;

-- Create index
CREATE INDEX idx_products_name_en ON products(name_en);
```

---

### 5. Upstash Redis KEYS Command Disabled

**Location**: `backend/src/services/sync-lock-service.ts`

**Issue**:
```
Error: ERR KEYS command is disabled because total number of keys is too large, please use SCAN
```

**Description**:
- Upstash (serverless Redis) disables the `KEYS` command for performance
- Any code using `client.keys('pattern*')` will fail
- This is a security/performance measure, not a bug

**Impact**:
- Code that worked locally with regular Redis fails on Upstash
- Affects any pattern-based key lookup

**Solution**:
Use `SCAN` with cursor iteration instead of `KEYS`:

```typescript
// ❌ DON'T DO THIS (fails on Upstash)
const keys = await client.keys('sync:promidata:lock:*');

// ✅ DO THIS INSTEAD
private async scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';

  do {
    const [nextCursor, foundKeys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...foundKeys);
  } while (cursor !== '0');

  return keys;
}

// Usage
const keys = await this.scanKeys('sync:promidata:lock:*');
```

**Key Difference**:
- `KEYS` blocks Redis and scans entire keyspace (O(N))
- `SCAN` iterates incrementally with cursor, non-blocking
- Both return same results, but `SCAN` is production-safe

**Affected Code**:
- `sync-lock-service.ts`: `getAllActiveSyncs()` and `forceReleaseAllLocks()`
- Any future code listing Redis keys by pattern

---

## Frontend Issues

### 1. Image Aspect Ratio Detection

**Location**: `frontend/src/components/ProductCard.tsx`

**Issue**:
```typescript
const strategy = (aspectRatio >= 1.2 && aspectRatio <= 1.8) ? 'cover' : 'contain';
```

**Description**:
- Hard-coded aspect ratio thresholds (1.2-1.8)
- Some images may not fit optimally
- Wide or tall images default to `contain` (white space)

**Impact**:
- Most images look good
- Some edge cases have extra white space
- No broken layouts (safe default)

**Potential Improvements**:
- Make thresholds configurable
- Add different strategies for portrait vs. landscape
- Allow per-product object-fit override

---

### 2. Filter State Cleanup

**Location**: `frontend/src/components/FilterBar.tsx`

**Issue**:
- Filters with empty values are sent to API
- API ignores them, but unnecessary query parameters

**Impact**:
- Minor performance impact
- Cleaner URL query parameters
- No functional issues

**Already Implemented**:
```typescript
// Clean up empty filter values before sending
const cleanedFilters = Object.entries(newFilters)
  .filter(([_, value]) => value !== '' && value !== null && value !== undefined)
  .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
```

---

### 3. Brand Filter Loads All Products

**Location**: `frontend/src/services/api.ts`

**Issue**:
```typescript
async getBrands(): Promise<string[]> {
  const response = await this.fetch<ApiResponse<Product[]>>(
    '/products?fields[0]=model&pagination[pageSize]=1000'
  );
  // ...
}
```

**Description**:
- Fetches 1000 products to extract unique brand names
- Inefficient for large product catalogs
- No backend endpoint for unique brands

**Impact**:
- Slow initial load for brand filter dropdown
- Unnecessary data transfer
- Works for current 1000+ products but won't scale

**Better Solution**:
- Add backend endpoint: `GET /api/products/brands`
- Return unique brands directly from database:
```sql
SELECT DISTINCT model FROM products WHERE model IS NOT NULL ORDER BY model;
```

---

## Integration Issues

### 1. Promidata API Rate Limiting

**Issue**:
- Promidata API may rate-limit requests
- No retry logic for failed requests
- Sync fails if rate limit hit

**Symptoms**:
- "429 Too Many Requests" errors
- Sync stops mid-process
- Products missing after sync

**Workaround**:
- Add delay between product fetches
- Implement exponential backoff
- Retry failed requests

**Recommended Fix**:
```typescript
// Add rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

for (const product of products) {
  await fetchProductData(product.url);
  await delay(100); // 100ms delay between requests
}
```

---

## Security Considerations

### 1. Public API Access

**Issue**:
- Products, categories, suppliers are publicly readable
- No authentication required
- Could be scraped by competitors

**Current State**:
- Intentional design for public catalog
- No sensitive data exposed
- Rate limiting not implemented

**Recommendation**:
- Add rate limiting (e.g., 100 requests/minute per IP)
- Implement pagination limits
- Monitor for scraping activity

---

### 2. Admin JWT Token Exposure

**Issue**:
- Admin JWT tokens in browser localStorage
- XSS vulnerability if site compromised
- Tokens don't expire automatically

**Workaround**:
- Keep Strapi updated (security patches)
- Use HTTPS in production (prevents MITM)
- Regularly rotate admin passwords

**Best Practice**:
- Use HttpOnly cookies (requires custom implementation)
- Implement token refresh mechanism
- Add IP-based access control

---

## Testing Gaps

### 1. No Automated Tests

**Issue**:
- No unit tests for services
- No integration tests for API
- No E2E tests for frontend

**Impact**:
- Regressions go unnoticed
- Manual testing required
- Difficult to refactor confidently

**Recommendation**:
- Add Vitest for backend unit tests
- Add Playwright for E2E tests (MCP available)
- Test critical paths: sync, product creation, filtering

---

## Monitoring Gaps

### 1. No Error Tracking

**Issue**:
- No centralized error logging
- Console logs only
- Difficult to debug production issues

**Recommendation**:
- Integrate Sentry (MCP available)
- Track backend errors
- Monitor frontend exceptions

---

### 2. No Performance Monitoring

**Issue**:
- No visibility into API performance
- Database query times unknown
- Sync duration not tracked

**Recommendation**:
- Integrate Datadog (MCP available)
- Monitor database queries
- Track sync performance metrics
- Set up alerts for slow endpoints

---

*Update this document when discovering new issues or implementing fixes.*
