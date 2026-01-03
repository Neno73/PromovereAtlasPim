# Architectural Decisions

*Last updated: 2026-01-03*

Decision log for PromoAtlas PIM. Keep decisions concise: Context → Decision → Consequences.

---

## [2026-01-03] Three-Layer Deduplication System

**Context**: Re-syncing suppliers caused duplicate uploads to R2 and Gemini FileSearchStore. Hash tracking wasn't working due to three bugs.

**Bugs Fixed**:
1. **SKU case mismatch** (`supplier-sync-worker.ts:205`): Promidata uses `Sku` (camelCase), code only checked `SKU`/`sku`
2. **Strapi 5 ID type** (`gemini-file-search.ts`): `entityService.update()` requires numeric `id`, not `documentId` (UUID)
3. **Repeatable component** (`product-transformer.ts`): `price_tiers` returned `undefined` instead of `[]`

**Decision**: Implement three-layer deduplication:
- **Promidata**: Skip products where `promidata_hash` matches (from Import.txt)
- **Images**: Skip uploads where filename already exists in R2
- **Gemini**: Skip uploads where `gemini_synced_hash === promidata_hash`

**Consequences**: ✅ 100% efficiency on re-sync (0 products processed, 0 images uploaded, 0 Gemini files created)

---

## [2026-01-03] Local Redis for Dev Environment Isolation

**Context**: Dev and prod Strapi instances shared the same Redis. Jobs enqueued by dev were processed by prod workers.

**Decision**: Use separate Redis instances per environment:
- **Dev**: Local Docker Redis on port 6380 (`docker run -d --name promoatlas-redis -p 6380:6379 redis:alpine`)
- **Prod**: Remote Redis at `46.62.239.73:5433`

**Consequences**: ✅ Zero config needed, complete isolation. Requires Docker for dev.

---

## [2025-12-25] Gemini Dashboard & Meilisearch ID Fix

**Context**: Gemini sync jobs completing but no products uploaded. Meilisearch ID format was wrong (`product-${id}` vs plain `documentId`).

**Decision**:
1. Fixed Meilisearch ID format (use `documentId` directly)
2. Built admin dashboard for FileSearchStore monitoring with semantic search testing

**Consequences**: ✅ Dashboard at `/admin/gemini-dashboard`. Search working with ~1,982 documents.

---

## [2025-12-05] Gemini FileSearchStore Namespace Fix

**Context**: `files.list()` returned 0 files, but semantic search worked. FileSearchStore is a separate namespace from Files API.

**Decision**:
1. Track sync status in Strapi via `gemini_file_uri` field (not FileSearchStore APIs)
2. Use `fileSearchStoreNames` (not `fileSearchStoreIds`) for queries
3. Accept file accumulation (no individual deletion support)

**Key Insight**: FileSearchStore files are NOT visible via `files.list()`. Verify with semantic search.

---

## [2025-11-27] Sync Lock Service

**Context**: Multiple sync requests queued 1M+ duplicate jobs. No concurrency control.

**Decision**: Redis-based distributed locking with graceful stop:
- Lock: `sync:promidata:lock:{id}` with 1h TTL
- Stop signal: `sync:promidata:stop:{id}` with 5min TTL
- UI: Sync button toggles to "Stop" while running

**API Endpoints**:
- `GET /api/promidata-sync/active` - List active syncs
- `POST /api/promidata-sync/stop/:supplierId` - Request stop

**Gotcha**: Upstash disables `KEYS` command → use `SCAN` instead.

---

## [2025-11-16] Queue System: Product Images & Status Tracking

**Decision**:
1. First variant's image → Product's `main_image`
2. Meilisearch jobs now include `documentId` (was undefined)
3. Supplier `last_sync_date` updated on job completion

---

## [2025-11-16] Schema Consolidation

**Context**: Product and ProductVariant had duplicate fields (description, material). Meilisearch calculated aggregations on-the-fly (~50ms/product).

**Decision**:
- Remove duplicates from ProductVariant
- Add aggregation fields to Product: `available_colors`, `available_sizes`, `hex_colors`, `price_min`, `price_max`
- Calculate during sync, not query time

**Consequences**: ✅ 10x Meilisearch improvement. ⚠️ Frontend must use `variant.product.description`.

---

## [2025-10-29] Product → ProductVariant Hierarchy

**Context**: Flat model duplicated data across size/color variants.

**Decision**: Two-level hierarchy:
- **Product**: Family data (pricing, images, descriptions) grouped by `a_number`
- **ProductVariant**: Size/color specific (dimensions, hex_color, `is_primary_for_color`)

**Consequences**: ✅ Less duplication, better catalog UI. ⚠️ Must populate variants relation.

---

## Foundational Decisions (Pre-2025-10)

| Decision | Rationale |
|----------|-----------|
| **Strapi 5** | Admin panel, REST API, lifecycle hooks, rapid dev |
| **React + Vite** | SPA (no SSR), fast HMR, static deploy |
| **CSS Modules** | Zero runtime, scoped styles, Vite-native |
| **Hash-Based Sync** | 89% efficiency, skip unchanged products |
| **Multilingual JSON** | Simpler than translation tables |
| **Cloudflare R2** | Zero egress fees vs S3 |
| **PostgreSQL (Coolify)** | Self-hosted, full control |

---

*Keep decisions concise. Log significant choices, not debugging sessions.*
