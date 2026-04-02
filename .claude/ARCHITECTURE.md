# Architecture

*Last updated: 2026-04-02*

System design for PromoAtlas PIM. For implementation patterns, see PATTERNS.md.

## System Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  React Frontend │────────▶│  Strapi Backend │────────▶│   PostgreSQL    │
│  (Port 3000)    │  REST   │  (Port 1337)    │  pg     │  (local:5433)   │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
            ┌───────────┐    ┌───────────┐    ┌───────────┐
            │ R2/SeaweedFS   │ Promidata │    │MeiliSearch│
            │  (Images) │    │   API     │    │  (7700)   │
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
| `image-upload` | 10 | Download from Promidata → R2/SeaweedFS |
| `meilisearch-sync` | 5 | Index products for search |

**Redis**: Local Docker (dev port 6382), Remote (prod)

**Monitoring**: Bull Board at `/admin/queue-dashboard`

### Sync Lock Service

**Location**: `backend/src/services/sync-lock-service.ts`

Redis-based distributed locking prevents duplicate syncs:
- Lock: `sync:promidata:lock:{id}` (1h TTL)
- Stop: `sync:promidata:stop:{id}` (5min TTL)

**API**: `GET /api/promidata-sync/active`, `POST /api/promidata-sync/stop/:id`

## AI Chat + Catalog Integration

### How Chat Drives the Product Grid

The AI chat assistant and the product catalog share a **unified filter state**. When the AI searches, it updates the same `SearchParams` that the sidebar, search bar, and URL use. There is no separate "chat mode" — both interfaces control the same view.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Search Bar  │────▶│              │     │              │
│  + Sidebar   │     │  SearchParams│────▶│  MeiliSearch │
│  Filters     │────▶│  (unified)   │     │  (hybrid)    │
└──────────────┘     └──────┬───────┘     └──────┬───────┘
      ▲                     │                     │
      │               ┌─────▼──────┐        ┌─────▼──────┐
      │               │  URL State │        │  Products   │
      │               │  (synced)  │        │  + Facets   │
      │               └────────────┘        └─────┬───────┘
      │                                           │
      │                                     ┌─────▼──────┐
      │                                     │ Product Grid│
      │                                     └────────────┘
      │
┌─────┴──────┐
│  AI Chat   │── updateCatalogFilters() ──▶ SearchParams
│  Panel     │◀── currentFilters + facets ──
└────────────┘
```

### Data Flow: Chat → Grid

1. User sends message in chat
2. `ChatPanel` sends `currentFilters`, `currentFacets`, `currentTotal` via request body
3. Server injects catalog state as dynamic context in AI system prompt
4. AI calls `updateCatalogFilters` tool with structured filters + text query
5. Tool merges AI args with existing filters, queries MeiliSearch
6. If 0 results: returns `filters_applied: null` (grid keeps previous view)
7. If results found: returns `filters_applied` (complete filter state) + slim product preview
8. `ChatPanel` extracts `filters_applied`, calls `onApplyFilters` (full replacement, not merge)
9. `SearchParams` updates → URL syncs → grid fetches → sidebar facets update

### Key Design Decisions

- **Chat panel always mounted** (CSS hidden, not unmounted) — `useChat` state persists across open/close
- **Sidebar independently collapsible** — user controls layout
- **Grid never goes blank** — zero-result searches don't update filters
- **"Clear all" resets chat too** — prevents stale AI context
- **Scroll to top on filter change** — viewport stays at search bar level

### Tool: `updateCatalogFilters`

**Location**: `frontend/src/app/api/chat/route.ts`

The AI's single tool for controlling the product grid. Returns:

| Field | Purpose |
|-------|---------|
| `filters_applied` | Complete filter state for frontend (null if 0 results) |
| `total` | Result count |
| `sample_products` | Slim previews (4 max) for AI reasoning |
| `available_facets` | Facet distributions for AI context |

### Hybrid Search (Semantic + Keyword)

**MeiliSearch 1.41** with hybrid search enabled. The `product_search` embedder uses OpenAI `text-embedding-3-small` (1536 dimensions).

**Document template** (what gets embedded):
```
Product: {{ doc.name_en }}. Brand: {{ doc.brand }}. Category: {{ doc.category }}.
{{ doc.description_en | truncatewords: 30 }} Colors: {{ doc.colors | join: ", " }}.
Supplier: {{ doc.supplier_name }}.
```

**How the AI decomposes search queries:**

| User intent | Type | Approach |
|-------------|------|----------|
| "polo shirts", "pens" | Structural | Category filter (exact) |
| "red", "Gildan", "under 5 EUR" | Structural | Color/brand/price filter (exact) |
| "organic cotton", "GOTS certified" | Descriptive | Text query (semantic matching on materials/descriptions) |
| "exclusive", "premium", "budget" | Qualitative | Text query + price sort (AI translates intent to structure) |
| "corporate gifts", "trade show" | Cross-category | Text query only (semantic search across all categories) |

**Combined example**: "exclusive organic cotton polo shirts in red" becomes:
- `category: "TEXTILES/SHIRTS-TOPS/POLO"` (structural)
- `colors: "Red"` (structural)
- `query: "exclusive organic cotton premium"` (semantic)
- `sort: "price_min:desc"` (qualitative → price)

**semanticRatio: 0.5** (default) — MeiliSearch auto-balances keyword precision and semantic meaning per query. Precise queries like SKUs favor keywords; descriptive queries like "eco-friendly" favor semantic.

### Admin Prompt Management

**Location**: `frontend/src/app/admin/page.tsx` + `frontend/src/data/prompts.json`

6 editable prompt sections control AI behavior:

| Section | Purpose |
|---------|---------|
| `regularPrompt` | Core AI identity and personality |
| `companyKnowledge` | Company info, values, services |
| `industryKnowledge` | Decoration methods, certifications, market knowledge |
| `preSearchQuestions` | Product discovery flow, filter-first strategy, Stage 1/2 logic |
| `productSearchFlow` | Tool usage guidelines, search stages |
| `brandVoice` | Tone, communication style |

**Auth**: Email/password login against env vars, HTTP-only cookie session (24hr).

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── app/
│   ├── page.tsx              # Catalog page (unified filter state)
│   ├── admin/page.tsx        # Admin prompt editor
│   └── api/
│       ├── chat/route.ts     # AI chat endpoint (Vercel AI SDK + Claude)
│       └── admin/            # Prompt CRUD + auth
├── components/
│   ├── ChatPanel.tsx         # AI chat (useChat, filter extraction)
│   ├── ChatWidget.tsx        # Toggle button
│   ├── FilterSidebar.tsx     # Collapsible sidebar with facets
│   ├── ProductGrid.tsx       # Product card grid
│   ├── SearchBar.tsx         # Debounced search input
│   └── filters/              # Category, Brand, Color, Size, Price filters
├── lib/
│   ├── chat-context.tsx      # Chat panel + sidebar state
│   ├── api.ts                # MeiliSearch API client
│   ├── types.ts              # All TypeScript interfaces
│   └── utils.ts              # Formatting, color mapping
└── data/
    └── prompts.json          # Persisted AI prompt sections
```

### Search API

**Endpoint**: `GET /api/products/search` (proxied to Strapi → MeiliSearch)

**Supports**: text query, category, brand, colors, sizes, price range, ids, sort, facets, hybrid search

**Hybrid search** activates automatically when a text query is present (`semanticRatio: 0.5`).

The `ids` filter (`id IN [...]`) enables AI curated selections — showing exactly the products the AI recommends.

### Multilingual Handling

```typescript
// Fallback chain: preferred → en → de → fr → es → first available
getLocalizedText(product.name, 'en')
```

## Data Flow

### Sync Flow
```
Admin trigger → Parse Import.txt → Filter by hash → Download JSON →
Transform data → Upload images to R2 → Create/update Strapi → Index to MeiliSearch
```

### Search Flow
```
User/AI input → SearchParams → MeiliSearch hybrid query → Products + Facets → Grid + Sidebar
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
