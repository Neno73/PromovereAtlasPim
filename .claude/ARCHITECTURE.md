# Architecture

*Last updated: 2026-01-03*

System design for PromoAtlas PIM. For implementation patterns, see PATTERNS.md.

## System Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  React Frontend │────────▶│  Strapi Backend │────────▶│   PostgreSQL    │
│  (Port 3000)    │  REST   │  (Port 1337)    │  pg     │   (Coolify)     │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
            ┌───────────┐    ┌───────────┐    ┌───────────┐
            │ R2 Images │    │ Promidata │    │  Gemini   │
            │           │    │   API     │    │ RAG Store │
            └───────────┘    └───────────┘    └───────────┘
```

## Content Types

### Product → ProductVariant Hierarchy

Two-level structure to reduce data duplication:

| Level | Purpose | Key Fields |
|-------|---------|------------|
| **Product** | Family data (shared) | `a_number`, name, description, price_tiers, main_image, `available_colors`, `price_min/max` |
| **ProductVariant** | Size/color specific | `sku`, color, size, hex_color, dimensions_*, `is_primary_for_color` |

**Schema files**: `backend/src/api/product/content-types/product/schema.json`

### Other Content Types

| Type | Purpose | Key Fields |
|------|---------|------------|
| **Supplier** | 56 Promidata suppliers | `code`, `is_active`, `last_sync_date/status` |
| **Category** | Hierarchical categories | `code`, `name` (multilingual), `parent` |

### Components

- **price-tier**: `quantity`, `price`, `currency`, `price_type`
- **dimensions**: `length`, `width`, `height`, `weight`, `unit`
- **imprint-position**: Customization data

## Backend Services

### Directory Structure

```
backend/src/
├── api/
│   ├── product/              # Products + variants
│   ├── promidata-sync/       # Sync orchestration (63KB main logic)
│   ├── gemini-sync/          # RAG integration
│   └── supplier/
├── services/
│   ├── queue/                # BullMQ workers
│   └── sync-lock-service.ts  # Distributed locking
└── index.ts                  # Bootstrap
```

### Promidata Sync Service

**Location**: `backend/src/api/promidata-sync/services/promidata-sync.ts`

**Flow**:
1. Parse `Import.txt` for product URLs + SHA-1 hashes
2. Skip unchanged products (hash match) → 89% efficiency
3. Download product JSON, transform multilingual fields
4. Upload images to R2, create/update in Strapi

**Config**:
```typescript
baseUrl: 'https://promi-dl.de/Profiles/Live/849c892e-b443-4f49-be3a-61a351cbdd23'
endpoints: { suppliers: '/Import/Import.txt', categories: '/Import/CAT.csv' }
```

### Queue System (BullMQ)

**Location**: `backend/src/services/queue/`

| Worker | Concurrency | Purpose |
|--------|-------------|---------|
| `supplier-sync` | 1 | Full supplier sync (sequential) |
| `product-family` | 3 | Group by a_number, create Product + Variants |
| `image-upload` | 10 | Download from Promidata → R2 |
| `meilisearch-sync` | 5 | Index products for search |
| `gemini-sync` | 5 | Upload to FileSearchStore |

**Redis**: Local Docker (dev port 6380), Remote (prod)

**Monitoring**: Bull Board at `/admin/queue-dashboard`

### Sync Lock Service

**Location**: `backend/src/services/sync-lock-service.ts`

Redis-based distributed locking prevents duplicate syncs:
- Lock: `sync:promidata:lock:{id}` (1h TTL)
- Stop: `sync:promidata:stop:{id}` (5min TTL)

**API**: `GET /api/promidata-sync/active`, `POST /api/promidata-sync/stop/:id`

### Gemini FileSearchStore

**Location**: `backend/src/api/gemini-sync/services/gemini-file-search.ts`

**Key Points**:
- FileSearchStore ≠ Files API (separate namespaces)
- Use `fileSearchStoreNames` not `fileSearchStoreIds` for queries
- Track sync via `gemini_file_uri` field on Product
- No individual file deletion (only full store)

**Dashboard**: `/admin/gemini-dashboard`

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── components/         # ProductCard, FilterBar
├── pages/              # ProductList, ProductDetail
├── services/api.ts     # Singleton API client
├── types/index.ts      # TypeScript interfaces
└── utils/i18n.ts       # Multilingual helpers
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `ProductCard` | Display product summary, smart image fitting |
| `FilterBar` | Search, category, supplier, price filters |
| `ProductList` | Paginated grid with sorting (12/page) |
| `ProductDetail` | Full product info by `documentId` |

### API Patterns (Strapi 5)

```typescript
// Filtering
params.append('filters[name][$containsi]', search);
params.append('filters[categories][id][$eq]', categoryId);

// Population
params.append('populate[supplier][fields]', 'code');
params.append('populate[main_image][fields]', 'url');

// Pagination
params.append('pagination[page]', page);
params.append('pagination[pageSize]', 12);
```

**Note**: Strapi 5 uses `documentId` (not numeric IDs), no `.attributes` wrapper.

### Multilingual Handling

```typescript
// Fallback chain: preferred → en → de → fr → es → first available
getLocalizedText(product.name, 'en')
```

## Data Flow

### Sync Flow
```
Admin trigger → Parse Import.txt → Filter by hash → Download JSON →
Transform data → Upload images to R2 → Create/update Strapi → Gemini sync
```

### Frontend Flow
```
User filters → API call → Strapi query → Populate relations → Render grid
```

## Key Indexes

- `products.sku` (unique)
- `products.promidata_hash` (incremental sync)
- `products.a_number` (product family grouping)
- `suppliers.code` (unique)

## Permissions

**Public (read-only)**: products, categories, suppliers
**Admin only**: write operations, sync triggers

---

*For code patterns see PATTERNS.md. For setup see STARTUP.md.*
