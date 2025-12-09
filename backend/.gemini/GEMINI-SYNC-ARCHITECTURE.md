# Gemini Sync Architecture

**Status**: ✅ PRODUCTION READY (as of 2025-12-05)  
**Test Success Rate**: 100% (35/35 jobs)  
**Data Flow**: Strapi → Meilisearch Plugin → Gemini FileSearchStore

## Overview

The Gemini sync system synchronizes product data from **Meilisearch** to **Google Gemini FileSearchStore** for AI-powered RAG (Retrieval Augmented Generation) in the chat UI.

---

## Data Flow

```
┌──────────────┐      sync       ┌──────────────┐      upload      ┌──────────────┐
│              │ ──────────────► │              │ ───────────────► │              │
│  Strapi DB   │                 │  Meilisearch │                  │    Gemini    │
│   (source)   │                 │   (index)    │                  │  FileSearch  │
│              │                 │              │                  │              │
└──────────────┘                 └──────────────┘                  └──────────────┘
                                        │                                 │
                                        │ product display data            │ semantic search
                                        │ (actual values)                 │ (product IDs)
                                        ▼                                 ▼
                                 ┌─────────────────────────────────────────────┐
                                 │              Chat UI (atlasv2)              │
                                 │                                             │
                                 │  1. User asks: "Show me blue t-shirts"      │
                                 │  2. AI uses Gemini RAG to find product IDs  │
                                 │  3. Frontend fetches data from Meilisearch  │
                                 │  4. Displays actual product data            │
                                 │                                             │
                                 │  → Prevents AI hallucinations!              │
                                 └─────────────────────────────────────────────┘
```

---

## Architecture Principle

> **"Always repair Meilisearch before repairing Gemini"**

### What This Means:

1. **Meilisearch is the single source of truth** for flattened, aggregated product data
2. If a product is not in Meilisearch, **skip Gemini sync** (don't fail the job)
3. The chat UI retrieves product IDs via Gemini semantic search
4. The chat UI **displays actual data from Meilisearch** (never from Gemini)
5. This prevents AI hallucinations in product display

### Why This Matters:

- **Data Consistency**: Same data format everywhere
- **Faster Sync**: Meilisearch already has indexed data, no DB queries needed
- **Single Transformation**: Only one place to transform product data
- **Reliable Display**: Users always see real product data

---

## Key Components

### 1. Gemini Sync Worker

**Location**: `src/services/queue/workers/gemini-sync-worker.ts`

**Responsibilities**:
- Processes jobs from the `gemini-sync` queue
- Fetches product data from Meilisearch (via the service)
- Handles errors gracefully (skips if not in Meilisearch)

**Job Data**:
```typescript
interface GeminiSyncJobData {
  operation: 'add' | 'update' | 'delete';
  documentId: string;
}
```

### 2. Gemini File Search Service

**Location**: `src/api/gemini-sync/services/gemini-file-search.ts`

**Responsibilities**:
- Reads product data FROM Meilisearch (not Strapi DB)
- Transforms Meilisearch documents to Gemini JSON format
- Uploads JSON files to Gemini FileSearchStore
- Manages FileSearchStore creation (with mutex for race conditions)

**Access**:
```typescript
const geminiService = strapi.service('api::gemini-sync.gemini-file-search');
```

### 3. Meilisearch Service (Dependency)

**Location**: `src/api/product/services/meilisearch.ts`

**Injected via**: `geminiService.setMeilisearchService(meilisearchService)` in bootstrap

**IMPORTANT**: We use the **Strapi Meilisearch Plugin** for indexing products, not direct calls to the custom service.

#### Plugin Format

The plugin indexes documents with:
- **Primary Key**: `_meilisearch_id`
- **ID Format**: `product-{documentId}`
- **Example**: `product-hyxvxzkmvle1t5smhcy7n34g`

**Document Structure**:
```json
{
  "_meilisearch_id": "product-hyxvxzkmvle1t5smhcy7n34g",
  "id": "hyxvxzkmvle1t5smhcy7n34g",
  "sku": "A407-2030",
  "updated_at": "2025-11-21T21:22:49.142Z"  // Note: snake_case, not camelCase
}
```

#### Code Adaptation

The Gemini service handles plugin format:
```typescript
// ID format (line 415 in gemini-file-search.ts)
const meilisearchId = `product-${documentId}`;
const doc = await index.getDocument(meilisearchId);

// Timestamp handling (lines 362-372)
updated_at: (meilisearchDoc as any).updated_at
  ? new Date((meilisearchDoc as any).updated_at).toISOString()
  : new Date().toISOString()
```

---

## Gemini JSON Document Structure

The Meilisearch document is transformed to this format for Gemini:

```json
{
  "id": "documentId",
  "sku": "A407-2030",
  "a_number": "A407",
  
  "name": {
    "en": "Product Name in English",
    "de": "Produktname auf Deutsch",
    "fr": "Nom du produit en français",
    "es": "Nombre del producto en español"
  },
  
  "description": {
    "en": "Full description...",
    "de": "Vollständige Beschreibung...",
    "fr": "Description complète...",
    "es": "Descripción completa..."
  },
  
  "supplier": {
    "name": "Supplier Name",
    "code": "SUP001"
  },
  
  "available_colors": ["Blue", "Red", "Green"],
  "available_sizes": ["S", "M", "L", "XL"],
  "hex_colors": ["#0000FF", "#FF0000", "#00FF00"],
  "total_variants": 12,
  
  "pricing": {
    "min": 5.99,
    "max": 12.99,
    "currency": "EUR"
  },
  
  "images": {
    "main": "https://...",
    "thumbnail": "https://..."
  },
  
  "is_active": true,
  "category_codes": ["CAT001", "CAT002"],
  
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-03-20T14:45:00.000Z"
}
```

---

## Environment Variables

Required for Gemini sync:

```bash
# Gemini API
GEMINI_API_KEY=your-api-key
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_PROJECT_NUMBER=your-project-number

# Optional - defaults to "PromoAtlas-RAG"
GEMINI_FILE_SEARCH_STORE_NAME=PromoAtlas-RAG

# Meilisearch (for data source)
MEILISEARCH_HOST=https://your-meilisearch-host
MEILISEARCH_ADMIN_KEY=your-admin-key
MEILISEARCH_INDEX_NAME=pim_products
```

---

## Debugging

### Check Queue Status

```bash
# View queue counts
node scripts/check-gemini-prerequisites.js

# Access Bull Board UI
# http://localhost:1337/admin/queues
```

### Common Issues

#### 1. "Product not in Meilisearch - skipped"

**Cause**: Product exists in Strapi but not yet indexed in Meilisearch

**Fix**: 
1. Trigger Meilisearch sync first
2. Then trigger Gemini sync

#### 2. "Meilisearch service not initialized"

**Cause**: Bootstrap failed to inject Meilisearch service

**Fix**: Check `src/index.ts` for `geminiService.setMeilisearchService()`

#### 3. "Failed to get or create Gemini FileSearchStore"

**Cause**: Gemini API error (auth, quota, network)

**Fix**: 
1. Verify GEMINI_API_KEY is valid
2. Check Google Cloud Console for quota limits

---

## Testing

### Queue 5 Test Products

```bash
cd backend
node scripts/queue-test-gemini-jobs.js
```

### Verify Gemini FileSearchStore

```bash
node scripts/check-gemini-prerequisites.js
```

---

## Archived Code

The old Strapi-based service is archived for reference:

**Location**: `src/services/gemini/_archive/gemini-service.strapi-based.ts`

This was replaced because:
- It fetched data directly from Strapi DB (slower)
- It duplicated transformation logic
- It violated the "Meilisearch as source of truth" principle
