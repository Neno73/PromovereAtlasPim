# Known Issues & Workarounds

*Last updated: 2025-11-16*

Known issues and workarounds in PromoAtlas PIM. **Fixed issues archived.**

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
