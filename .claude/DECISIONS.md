# Architectural Decisions

*Last updated: 2025-12-05*

This log tracks significant architectural decisions made during the development of PromoAtlas PIM.

## Decision Template

When adding a decision, include:
- **Date**: When the decision was made
- **Context**: What problem we're solving
- **Decision**: What we decided to do
- **Consequences**: Trade-offs and implications
- **Status**: Proposed / Accepted / Deprecated / Superseded

---

## [2025-12-05] Gemini FileSearchStore: Namespace Fix & Strapi-Based Tracking

**Status**: Accepted (Completed)

**Context**:
A mystery emerged during Gemini sync operations:
- Logs showed "✅ Synced product X to Gemini File Search"
- But `files.list()` returned 0 files
- `getStats()` always reported 0 files
- `deleteDocument()` for deduplication silently failed
- Meanwhile, the atlasv2 chat UI (deployed on Vercel) correctly found products via semantic search

Investigation revealed:
1. Files ARE uploaded to FileSearchStore (confirmed via atlasv2 semantic search)
2. `files.list()` queries the default Files API namespace, NOT FileSearchStore
3. FileSearchStore uses a completely different API than the standard Files API
4. The atlasv2 chat UI uses correct API format: `fileSearchStoreNames` not `fileSearchStoreIds`
5. FileSearchStore does NOT support individual file deletion (only entire store deletion)

**Decision**:
Implemented Strapi-based tracking instead of relying on FileSearchStore APIs for stats/deduplication:

1. **Added `gemini_file_uri` field to Product schema**:
   - Tracks sync status per product
   - Set to operation name after successful upload
   - Set to `null` when cleared

2. **Fixed `getStats()` to use Strapi EntityService**:
   ```typescript
   async getStats() {
     const syncedProducts = await strapi.entityService.count('api::product.product', {
       filters: { gemini_file_uri: { $notNull: true } }
     });
     const totalProducts = await strapi.entityService.count('api::product.product', {});
     return { syncedProducts, totalProducts, ... };
   }
   ```

3. **Fixed `deleteDocument()` to clear tracking field**:
   ```typescript
   async deleteDocument(documentId: string) {
     // Note: FileSearchStore doesn't support individual file deletion
     await strapi.entityService.update('api::product.product', documentId, {
       data: { gemini_file_uri: null }
     });
     return { success: true };
   }
   ```

4. **Removed broken deduplication logic**:
   - Old code tried to delete existing files before re-upload
   - This never worked (wrong API namespace)
   - Files accumulate in FileSearchStore but semantic search still works

5. **Fixed `healthCheck()` to verify FileSearchStore access**:
   ```typescript
   async healthCheck() {
     const storeId = await this.getOrCreateStore();
     return !!storeId;
   }
   ```

**Implementation**:

Files Modified:
- `backend/src/api/gemini-sync/services/gemini-file-search.ts`:
  - Removed broken deduplication (lines 430-439)
  - Added `gemini_file_uri` save after upload
  - Rewrote `getStats()` to use Strapi counts
  - Rewrote `deleteDocument()` to clear tracking field
  - Fixed `healthCheck()` to verify store access

Files Created:
- `backend/scripts/verify-gemini-store.js` - Verification script for debugging

**Verification**:
- Ran semantic search query "Show me chewing gum products"
- Successfully returned products A407-2030, A407-2031 (Commercial Sweets)
- Confirmed files ARE in FileSearchStore
- Build compiles without TypeScript errors

**Consequences**:

*Positive*:
- **Accurate Stats**: `getStats()` now returns correct sync counts
- **Clear Tracking**: `gemini_file_uri` shows which products are synced
- **Working healthCheck**: Properly verifies FileSearchStore access
- **No Breaking Changes**: Existing synced files remain searchable

*Negative*:
- **No True Deduplication**: Files accumulate in FileSearchStore
- **Storage Growth**: Repeated syncs add duplicate files
- **Strapi Dependency**: Stats require Strapi database access

*Trade-offs*:
- Accepted file accumulation (semantic search still works correctly)
- Chose Strapi tracking over FileSearchStore metadata (more reliable)
- Store ID discovery via displayName vs. hardcoded ID (more flexible)

**Key Learnings**:

1. **FileSearchStore is a separate namespace**: Files uploaded there are NOT visible via `files.list()`
2. **API format matters**: Use `fileSearchStoreNames` not `fileSearchStoreIds` for queries
3. **No individual deletion**: FileSearchStore only supports full store deletion
4. **Verify with semantic search**: The definitive test is whether AI can find the content

**Related Documentation**:
- ARCHITECTURE.md updated with Gemini FileSearchStore Service section
- GOTCHAS.md updated with FileSearchStore limitations
- Verification script: `backend/scripts/verify-gemini-store.js`

---

## [2025-11-27] Sync Lock Service: Distributed Locking & Graceful Stop

**Status**: Accepted (Completed)

**Context**:
A critical incident occurred when the Gemini sync endpoint was called multiple times (likely from UI clicks), resulting in:
- Over 1 million duplicate jobs queued in the gemini-sync queue
- Multiple background processes running simultaneously
- Queue growing at ~10,000 jobs/second
- No mechanism to stop runaway syncs
- No protection against concurrent sync operations

The system had no:
1. Distributed lock mechanism to prevent concurrent syncs
2. Stop signal to gracefully terminate running syncs
3. UI feedback showing sync status
4. Way to cancel a sync once started

**Decision**:
Implemented a comprehensive sync concurrency control system:

1. **Sync Lock Service** (`src/services/sync-lock-service.ts`):
   - Redis-based distributed locking using NX SET with TTL
   - Separate lock namespaces for Promidata and Gemini syncs
   - Stop signal mechanism via Redis keys
   - Auto-expiry: 1 hour for locks, 5 minutes for stop signals
   - Uses SCAN instead of KEYS (Upstash compatibility)

2. **API Endpoints**:
   - `GET /api/promidata-sync/active` - List active syncs (public for UI polling)
   - `POST /api/promidata-sync/stop/:supplierId` - Request graceful stop
   - `GET /api/gemini-sync/active` - List active Gemini syncs
   - `POST /api/gemini-sync/stop/:supplierCode` - Request Gemini stop

3. **Worker Integration**:
   - supplier-sync-worker checks stop signal between processing steps
   - gemini-sync controller checks stop signal between batches
   - Locks released in completed/failed event handlers
   - Graceful shutdown: completes current batch before stopping

4. **Admin UI Changes** (`src/admin/pages/supplier-sync.tsx`):
   - Sync button toggles to "Stop" while sync is running
   - Polls /api/promidata-sync/active every 5 seconds
   - Tracks syncing state for both Promidata and Gemini
   - Shows active sync count badge

**Implementation**:

Files Created:
- `backend/src/services/sync-lock-service.ts` - Centralized lock/stop service

Files Modified:
- `backend/src/api/promidata-sync/controllers/promidata-sync.ts` - Lock acquisition, stop endpoints
- `backend/src/api/promidata-sync/routes/promidata-sync.ts` - New routes
- `backend/src/api/gemini-sync/controllers/gemini-sync.ts` - Lock acquisition, stop signal checking
- `backend/src/api/gemini-sync/routes/gemini-sync.ts` - New routes
- `backend/src/services/queue/workers/supplier-sync-worker.ts` - Stop signal checking, lock release
- `backend/src/admin/pages/supplier-sync.tsx` - Toggle Sync/Stop UI

Key Code Pattern (Distributed Lock):
```typescript
// Acquire lock (returns null if already locked)
const syncId = await syncLockService.acquirePromidataLock(supplierId);
if (!syncId) {
  return { success: false, isRunning: true, message: 'Sync already running' };
}

// Check stop signal in worker loop
const shouldStop = await syncLockService.isPromidataStopRequested(supplierId);
if (shouldStop) {
  return { stopped: true, message: 'Sync stopped by user' };
}

// Release lock in event handler
worker.on('completed', async (job) => {
  await syncLockService.releasePromidataLock(supplierId);
});
```

**Consequences**:

*Positive*:
- **No More Runaway Syncs**: Duplicate sync requests immediately rejected
- **Graceful Cancellation**: Users can stop syncs mid-process
- **Clear UI Feedback**: Button state shows sync is running
- **Auto-Recovery**: TTL ensures orphaned locks auto-release
- **Distributed**: Works across multiple Strapi instances

*Negative*:
- **Redis Dependency**: Sync operations now require Redis connectivity
- **Polling Overhead**: UI polls every 5 seconds (minimal impact)
- **Complexity**: Additional service layer for lock management

*Trade-offs*:
- Chose Redis over database for locks (faster, auto-expiry built-in)
- Chose polling over WebSocket (simpler, sufficient for admin UI)
- Chose SCAN over KEYS (required for Upstash compatibility)

**Gotcha Discovered**:
Upstash Redis disables the KEYS command for performance reasons. Had to use SCAN with cursor iteration instead. See GOTCHAS.md for details.

**Verification**:
- Build compiles without TypeScript errors
- Backend starts with all 5 workers
- Duplicate sync request blocked: `Failed to acquire Gemini lock for A109 - already running`
- Active syncs endpoint returns correct data

**Related Documentation**:
- ARCHITECTURE.md updated with Sync Lock Service section
- GOTCHAS.md updated with Upstash KEYS restriction

---

## [2025-11-16] Queue System Enhancements: Product Images, Meilisearch Sync & Status Tracking

**Status**: Accepted (Completed)

**Context**:
During active Promidata sync operations, three critical issues were identified:
1. **Missing Product images**: Products had no main_image, only variants had images
2. **Meilisearch sync failures**: 61 jobs failing with missing documentId in job data
3. **Stale sync dates**: Supplier last_sync_date not updating after sync completion

**Decision**:
Implemented three interconnected enhancements to the queue system:

1. **Product-Level Images from First Variant**:
   - Track first variant with `isFirstVariant` flag in product-family-worker
   - For deduplicated images: Immediately set Product's main_image
   - For new uploads: Add `updateParentProduct` and `parentProductId` flags to ImageUploadJobData
   - Image-upload-worker checks flags and updates Product after variant image upload

2. **Meilisearch documentId Propagation**:
   - Added `documentId?: string` to VariantSyncResult interface
   - Modified `create()` and `update()` to capture and return documentId from Strapi response
   - Updated product-family-worker to pass documentId instead of undefined
   - Added validation to warn if documentId missing before enqueue

3. **Supplier Sync Status Tracking**:
   - Added async event handlers to supplier-sync-worker
   - On `completed`: Update supplier with `last_sync_date`, `last_sync_status: 'completed'`, and statistics message
   - On `failed`: Update supplier with `last_sync_date`, `last_sync_status: 'failed'`, and error message

4. **Admin UI Icon Visibility**:
   - Created `DarkIcon` wrapper component with color `#32324D`
   - Changed sidebar icon property from string to function returning styled component
   - Used Unicode symbols (⟳, ■, ☰) for clean, visible icons

**Implementation**:

Files Modified:
- `backend/src/services/queue/job-types.ts`: Added `updateParentProduct`, `parentProductId`, `index` fields to ImageUploadJobData
- `backend/src/services/queue/workers/product-family-worker.ts`: Implemented first variant → Product image logic, fixed Meilisearch documentId
- `backend/src/services/queue/workers/image-upload-worker.ts`: Added Product update logic when flags set
- `backend/src/services/promidata/sync/variant-sync-service.ts`: Added documentId to VariantSyncResult and return values
- `backend/src/services/queue/workers/supplier-sync-worker.ts`: Added completed/failed event handlers for status tracking
- `backend/src/admin/app.tsx`: Fixed sidebar icon colors with DarkIcon component

Key Code Pattern (Product Image Update):
```typescript
// Track first variant
let isFirstVariant = true;

// For deduplicated images
if (dedupCheck.exists && dedupCheck.mediaId && isFirstVariant) {
  await strapi.entityService.update('api::product.product', productId, {
    data: { main_image: dedupCheck.mediaId }
  });
}

// For new uploads
const imageJobData: ImageUploadJobData = {
  updateParentProduct: isFirstVariant,
  parentProductId: isFirstVariant ? productId : undefined
  // ... other fields
};

// After first variant processed
if (isFirstVariant) isFirstVariant = false;
```

**Consequences**:

*Positive*:
- **Product Images**: Products now have main_image from first variant, improving catalog display
- **Meilisearch Reliability**: All future sync jobs include documentId, preventing failures
- **Status Transparency**: Suppliers show current sync status and last sync date in admin UI
- **Icon Visibility**: Admin sidebar icons visible in dark color, improving UX
- **Deduplication Optimized**: Existing images set immediately without job overhead

*Negative*:
- **Additional Complexity**: Product-family-worker now tracks first variant state
- **Job Data Size**: ImageUploadJobData interface has 3 additional optional fields
- **Tight Coupling**: Image-upload-worker now depends on product-sync-service

*Trade-offs*:
- Chose immediate Product update for deduplicated images (faster) vs. always queuing jobs (simpler)
- Chose event handlers for status tracking (real-time) vs. polling approach (less complex)
- Chose `is_primary_for_color` flag on variants (explicit) vs. always using first variant (implicit)

**Verification**:
- Backend compiled successfully without TypeScript errors
- All 4 BullMQ workers initialized (supplier-sync, product-family, image-upload, meilisearch-sync)
- Strapi started successfully on port 1337
- Queue system operational with proper status tracking

**Related Issues Fixed**:
- TypeScript error: `updateParentProduct` property missing → Added to job-types.ts
- TypeScript error: `index` property missing → Added to interface
- TypeScript error: `'success'` not assignable to enum → Changed to `'completed'`
- Meilisearch job data missing documentId → Propagated from entity service

---

## [2025-11-16] Product/ProductVariant Schema Consolidation & Aggregation Fields

**Status**: Accepted (Completed)

**Context**:
Before schema consolidation, both Product and ProductVariant extracted the same product-level fields from Promidata, resulting in:
- Data duplication (description, material, etc. stored 10+ times per product family)
- Data inconsistency risk (variant fields could diverge from product fields)
- RAG export confusion (which source of truth to use?)
- Poor search performance (Meilisearch calculating aggregations on-the-fly for every query)
- Inefficient database storage

Additionally, Meilisearch service was calculating aggregations (available_colors, available_sizes, price_min, price_max) on-the-fly for every product query, causing ~50ms transformation overhead per product (10x slower than necessary).

**Decision**:
1. **Remove duplicate fields from ProductVariant**: Removed description, short_description, material, country_of_origin, production_time
2. **Add aggregation fields to Product**: Added available_colors, available_sizes, hex_colors, price_min, price_max, rag_metadata
3. **Calculate aggregations during sync**: product-transformer.ts now calculates and stores aggregation fields in database
4. **Update Meilisearch to use stored fields**: Changed from on-the-fly calculation to direct field access

**Implementation**:
- **Product schema**: Added 6 new aggregation fields (available_colors, available_sizes, hex_colors, price_min, price_max, rag_metadata)
- **ProductVariant schema**: Removed 5 duplicate fields
- **product-transformer.ts**: Added 3 helper methods (extractAvailableHexColors, calculateMinPrice, calculateMaxPrice)
- **variant-transformer.ts**: Commented out 5 extraction methods with detailed reasons
- **meilisearch.ts**: Replaced ~40 lines of calculation logic with simple field access

**Consequences**:
- **Positive**:
  - Single source of truth for product data (Product model)
  - 10x Meilisearch performance improvement (~50ms → ~5ms per product)
  - Better RAG export quality (consistent, deduplicated data)
  - Reduced database storage (no duplicate text across 10+ variants)
  - Clearer data model (variant-specific vs product-level data separation)
  - Pre-calculated aggregations ready for frontend (colors, sizes, price range)
- **Negative**:
  - Breaking API changes (ProductVariant fields removed)
  - Requires full sync to populate aggregation fields for existing products
  - Frontend must use `variant.product.description` instead of `variant.description`
- **Trade-offs**:
  - Aggregation fields only updated during Promidata sync (not when variants manually updated)
  - Could implement lifecycle hooks to auto-recalculate, but adds complexity

**Migration Path**:
- Database columns not dropped (data preserved, just not exposed via Strapi)
- Comprehensive migration guide created: `backend/docs/SCHEMA_CONSOLIDATION_2025-11-16.md`
- Rollback possible via database restore or code revert

**RAG Preparation**:
- `rag_metadata` field added with empty default `{}`
- Will be populated separately when scaling to 100,000 products
- Reserved for AI-generated semantic tags, use cases, target audience, sustainability scores

**Related Documentation**:
- Schema consolidation guide: `backend/docs/SCHEMA_CONSOLIDATION_2025-11-16.md`
- Updated ARCHITECTURE.md to reflect new schema structure (2025-11-16)

---

## [2025-11-02] Product Hierarchy Migration Completion & TypeScript Resolution

**Status**: Accepted (Completed)

**Context**:
After implementing the Product → Product Variant hierarchy (2025-10-29), the system had 17 TypeScript compilation errors in controller files that were still accessing variant-specific fields directly on the Product model. Additionally, database connection issues prevented the backend from starting (ECONNRESET errors).

**Issues Encountered**:
1. Controllers (`promidata-sync.ts`, `supplier.ts`) referenced fields that moved from Product to ProductVariant (colors, sizes, dimensions, etc.)
2. Database connection timing out during Strapi initialization
3. Queue system imports causing connection attempts during module load

**Decision**:
1. **Refactored Controllers**: Updated all controllers to:
   - Populate `variants` relation when querying products
   - Extract variant-specific data by iterating through `variants` array
   - Provide fallback values for backward compatibility

2. **Lazy Redis Connection**: Modified `queue-config.ts` to use lazy initialization via Proxy to prevent connection attempts during module load

3. **Database Configuration**: Confirmed correct Neon PostgreSQL connection string and verified database was accessible

**Implementation**:
- `backend/src/api/promidata-sync/controllers/promidata-sync.ts`: Added variant population and data extraction logic
- `backend/src/api/supplier/controllers/supplier.ts`: Refactored to show both product-level and variant-level fields
- `backend/src/services/queue/queue-config.ts`: Implemented lazy Redis connection pattern

**Consequences**:
- **Positive**:
  - All TypeScript compilation errors resolved (0 errors)
  - Backend starts successfully with all systems operational
  - Queue system fully functional with 3 workers
  - Controllers properly handle Product/Variant hierarchy
  - Clean separation between product and variant data
- **Negative**:
  - Requires more complex queries (must populate variants)
  - Slightly increased query complexity in controllers
- **Lessons Learned**:
  - Always check database connectivity first when experiencing ECONNRESET errors
  - Lazy initialization prevents premature service connections
  - Migration requires updating all code that accessed migrated fields

**Status as of 2025-11-02 20:40**: ✅ Fully operational

---

## [2025-10-29] Product → Product Variant Hierarchy Migration

**Status**: Accepted

**Context**:
The system initially used a flat Product model where each SKU (size/color combination) was a separate product record. This led to:
- Duplicate product information (main images, descriptions, pricing) across size/color variants
- Difficult variant management (no grouping of related products)
- Complex frontend logic to display products with size/color selection
- Inability to easily identify which variants belong to the same product family

**Decision**:
Implemented a two-level hierarchy:
- **Product**: Main product/family (e.g., "Classic T-Shirt") with shared data (pricing, main images, descriptions, brand)
- **Product Variant**: Individual size/color combinations (e.g., "Classic T-Shirt - Black - Large") with variant-specific data

Key design choices:
1. Products grouped by `a_number` (Promidata product family identifier)
2. Product has `variants` relation (one-to-many)
3. Product Variant has flattened dimension fields (not component) for query performance
4. `is_primary_for_color` flag on variants for product listing display
5. Both Product and Variant preserve all PromoAtlas custom fields (hex_color, imprint_position, autorag, etc.)

**Implementation**:
- Created `src/api/product/` (replaces flat model)
- Created `src/api/product-variant/`
- Updated bootstrap permissions for public API access
- Documentation: `backend/docs/HIERARCHY_MIGRATION.md`

**Consequences**:

*Benefits*:
- Reduced data duplication (pricing/images stored once at Product level)
- Better variant management and catalog UI
- Clearer data model matching real-world product families
- Easier to query "show me all variants of this product"
- Frontend can display size/color selectors properly

*Trade-offs*:
- Promidata sync service requires refactoring (group by a_number, create Products + Variants)
- More complex queries (need to populate variants relation)
- Existing frontend code needs updating to query new structure
- TypeScript errors in legacy code until sync service updated

*Migration Path*:
- Sync service updates documented in `backend/docs/HIERARCHY_MIGRATION.md`
- Frontend queries need adjustment (populate variants, use is_primary_for_color)
- Old flat structure backed up in `product-legacy/` (removed from build)

**Related Documentation**:
- Blueprint: `/home/neno/Code/PIM/STRAPI_CONTENT_TYPE_BLUEPRINT.md`
- Migration Guide: `backend/docs/HIERARCHY_MIGRATION.md`
- Updated ARCHITECTURE.md to reflect new schema

---

## [2025-10-29] Thoughtful Dev Documentation Structure Initialized

**Status**: Accepted

**Context**:
PromoAtlas PIM system needed comprehensive documentation for both human developers and Claude Code. The codebase had grown complex with Strapi 5 backend, React frontend, Promidata integration, and AutoRAG sync capabilities. A single CLAUDE.md file was insufficient to document all patterns, architecture, and operational procedures without overwhelming context.

**Decision**:
Implemented Thoughtful Dev plugin's documentation structure:
- **CLAUDE.md** (root) - Lean manifest with essential commands and core principles, auto-loaded every session
- **.claude/** directory - Detailed documentation imported on-demand via `@import` statements
  - INDEX.md - Documentation directory
  - STACK.md - Tech stack with versions and rationale
  - ARCHITECTURE.md - System design and component structure
  - PATTERNS.md - Code conventions specific to this project
  - STARTUP.md - Setup guide and troubleshooting
  - GOTCHAS.md - Known issues and workarounds
  - DECISIONS.md - This file for architectural decision history

**Consequences**:
- **Positive**:
  - Progressive disclosure prevents context pollution
  - Claude Code loads only relevant documentation for current task
  - Human developers have clear navigation via INDEX.md
  - Documentation tracks actual codebase patterns (not generic best practices)
  - Timestamps track when documentation was updated
- **Negative**:
  - Requires discipline to keep documentation updated
  - Multiple files to maintain instead of one
  - Learning curve for new contributors
- **Mitigation**:
  - `doc-maintenance` skill set to "ask" mode to prompt updates
  - `/thoughtful-dev:audit-docs` command for checking drift
  - Clear instructions in INDEX.md on when to read each file

---

## [Pre-2025-10-29] Foundational Technology Decisions

**Status**: Accepted

**Summary of Core Stack Decisions**:

1. **Strapi 5** as Backend Framework
   - Headless CMS with admin panel, REST API, lifecycle hooks
   - Chosen for rapid development and flexible content modeling
   - PostgreSQL support with JSON fields for multilingual content

2. **React + Vite** for Frontend (Not Next.js)
   - Simple SPA (no SSR needed), fast dev experience, static build deployment
   - Trade-off: No SEO optimization, but not critical for internal PIM tool

3. **CSS Modules** (Not Tailwind or styled-components)
   - Zero runtime overhead, familiar CSS syntax, scoped styles
   - Works out-of-box with Vite

4. **Hash-Based Incremental Sync**
   - 89% efficiency using SHA-1 hashes from Promidata Import.txt
   - Skip unchanged products, process only changed ones
   - Periodic full sync needed for consistency

5. **Multilingual Data as JSON Fields**
   - Simpler schema (no translation tables), atomic updates
   - Trade-off: Cannot index JSON efficiently, need generated columns for search

6. **Cloudflare R2** for Image Storage
   - Zero egress fees vs. S3, S3-compatible API
   - Cost: R2 = $0.15 vs S3 = $9.23 (for 10GB + 100GB egress)

7. **PostgreSQL via Neon** (Serverless)
   - Auto-scaling, built-in connection pooling, instant branches
   - Trade-off: Vendor lock-in, cold start latency

**Details**: See STACK.md for versions and rationale. These decisions remain valid and are not frequently revisited.

---

*Log all significant architectural decisions here to maintain institutional knowledge.*
