# QDRANT Vector Database Export - Implementation Plan & Architecture

**Version**: 1.0
**Date**: 2025-01-03
**Status**: Planned (Not Yet Implemented)
**Estimated Effort**: 2.5 days

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Current State Analysis](#current-state-analysis)
4. [Implementation Plan](#implementation-plan)
5. [Technical Specifications](#technical-specifications)
6. [Migration from AutoRAG](#migration-from-autorag)
7. [Testing Strategy](#testing-strategy)
8. [Deployment Checklist](#deployment-checklist)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Future Enhancements](#future-enhancements)
11. [Appendix](#appendix)

---

## Executive Summary

### Goals

Create a Qdrant vector database export system to enable AI-powered semantic search for promotional products, replacing the current Cloudflare AutoRAG implementation while keeping AutoRAG code intact for potential future use.

### Key Decisions

- **Architecture**: Custom API module (not full Strapi plugin) - simpler and faster
- **Sync Strategy**: Scheduled cron jobs (daily + 12-hour incremental) - no instant updates needed
- **Queue System**: Leverage existing BullMQ infrastructure for async processing
- **Embedding Provider**: OpenAI `text-embedding-3-small` (1536 dimensions, $0.02/1M tokens)
- **Code Reuse**: Preserve 70% of AutoRAG transformation logic

### Success Metrics

- ✅ Export 1000+ products to Qdrant successfully
- ✅ Vector search returns relevant results (tested manually)
- ✅ Cron jobs run reliably on schedule
- ✅ Queue throughput: 300+ products/hour
- ✅ < 1 second per product export (including embedding generation)

---

## Architecture Overview

### High-Level Data Flow

```
┌─────────────────┐
│  Strapi Product │
│   (PostgreSQL)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Cron Job       │◄── Daily (3 AM) + 12-hour (3 AM/PM)
│  Triggers       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  BullMQ Queue   │
│  (Redis)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Qdrant Worker  │◄── Concurrency: 5 jobs parallel
│  (Transform +   │
│   Embed)        │
└────────┬────────┘
         │
         ├──────────────────┐
         │                  │
         ▼                  ▼
┌─────────────────┐  ┌──────────────────┐
│  OpenAI API     │  │  Product         │
│  (Embeddings)   │  │  Transformer     │
│  1536-dim       │  │  (Reuse AutoRAG) │
└────────┬────────┘  └─────────┬────────┘
         │                     │
         └──────────┬──────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  Qdrant Client  │
           │  (Upsert Point) │
           └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │  Qdrant Vector  │
           │   Database      │
           │  (Real-time)    │
           └─────────────────┘
```

### Directory Structure

```
backend/
├── src/
│   ├── api/
│   │   └── qdrant-export/
│   │       ├── controllers/
│   │       │   └── qdrant-export.ts       # HTTP handlers
│   │       ├── routes/
│   │       │   └── qdrant-export.ts       # API route definitions
│   │       └── services/
│   │           └── qdrant-export.ts       # Main export logic
│   │
│   └── services/
│       ├── queue/
│       │   └── workers/
│       │       └── qdrant-export-worker.ts # BullMQ worker
│       │
│       └── qdrant/
│           ├── qdrant-client.ts           # Qdrant SDK wrapper
│           ├── embedding-service.ts       # OpenAI integration
│           └── transformers/
│               └── product-transformer.ts # Strapi → Qdrant format
│
├── config/
│   └── cron.ts                            # Add Qdrant cron jobs
│
└── .claude/
    └── QDRANT_IMPLEMENTATION_PLAN.md      # This document
```

---

## Current State Analysis

### Existing AutoRAG Implementation

**Location**: `backend/src/services/autorag.ts` (403 lines)

**How it works**:
1. Products exported as JSON files to Cloudflare R2 bucket
2. Format: `{SUPPLIER_CODE}_{SKU}.json`
3. AutoRAG indexes R2 bucket every 6 hours (Cloudflare limitation)
4. Sync is **manual only** (no lifecycle hooks despite documentation claiming otherwise)

**Key Methods** (reusable):
- `transformProductForAutoRAG()` - Product data transformation ✅ **70% reusable**
- `bulkUploadProducts()` - Batch processing pattern ✅ **Reusable**
- `buildCategoryHierarchy()` - Category path building ✅ **Reusable**
- `buildIndustryContext()` - Promotional context generation ✅ **Reusable**

### Current Sync Infrastructure

**BullMQ Queue System**: ✅ **Operational**
- 3 workers running: `supplier-sync`, `product-family`, `image-upload`
- Redis: Upstash connection stable
- Concurrency levels: 1, 3, 10 respectively
- Retry logic: 3 attempts with exponential backoff

**Cron Jobs**: ✅ **Operational**
- `nightlySupplierSync`: 2:00 AM daily
- Pattern established in `backend/config/cron.ts` (229 lines)
- Timezone: Europe/Amsterdam

### Limitations of AutoRAG

1. ❌ **No lifecycle hooks** - Products not synced automatically on create/update
2. ❌ **6-hour indexing delay** - Products not searchable immediately
3. ❌ **Hard-coded for A113** - Other suppliers require code changes
4. ❌ **Flat category hierarchy** - TODO comment exists
5. ❌ **No scheduled sync** - `sync_frequency` field exists but not enforced

---

## Implementation Plan

### Phase 1: Core Infrastructure (Day 1)

#### 1.1 Install Dependencies

```bash
cd backend
npm install @qdrant/js-client-rest
npm install openai
```

#### 1.2 Environment Variables Setup

Add to `backend/.env`:

```bash
# Qdrant Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=products

# OpenAI Embeddings
OPENAI_API_KEY=sk-...

# BullMQ Queue
BULLMQ_CONCURRENCY_QDRANT=5
```

#### 1.3 Create Qdrant Client Wrapper

**File**: `backend/src/services/qdrant/qdrant-client.ts`

Key responsibilities:
- Initialize Qdrant client with environment config
- Create collection with vector configuration (1536 dimensions, Cosine distance)
- Upsert/delete vector points
- Search functionality
- Collection management

#### 1.4 Create Embedding Service

**File**: `backend/src/services/qdrant/embedding-service.ts`

Key responsibilities:
- OpenAI API integration
- Generate embeddings (single & batch)
- Embedding cache for cost optimization
- Cost tracking and logging

---

### Phase 2: Data Pipeline (Day 2)

#### 2.1 Product Transformer (Reuse AutoRAG Logic)

**File**: `backend/src/services/qdrant/transformers/product-transformer.ts`

**Reusable from AutoRAG**:
- `transformProduct()` - 70% code reuse
- `buildCategoryHierarchy()` - Direct reuse
- `buildIndustryContext()` - Direct reuse
- Multilingual field extraction
- Variant data extraction

**New for Qdrant**:
- `buildEmbeddingText()` - Combine multilingual content for vector generation
- Structure data as Qdrant point (id, vector, payload)

#### 2.2 Create BullMQ Worker

**File**: `backend/src/services/queue/workers/qdrant-export-worker.ts`

Job data structure:
```typescript
{
  productId: number,
  operation: 'upsert' | 'delete'
}
```

Features:
- Concurrency: 5 jobs parallel
- Retry: 3 attempts with exponential backoff
- Timeout: 60 seconds per job
- Event logging (completed, failed, error)

#### 2.3 Queue Service Integration

**File**: `backend/src/services/queue/queue-service.ts`

New methods:
- `enqueueQdrantExport(productId, operation)` - Single product
- `bulkEnqueueQdrantExport(productIds, operation)` - Batch
- `getQdrantQueueStats()` - Monitor queue state

#### 2.4 Worker Registration

**File**: `backend/src/services/queue/worker-manager.ts`

Register Qdrant worker alongside existing workers (supplier-sync, product-family, image-upload).

---

### Phase 3: API & Automation (Day 3)

#### 3.1 Create Main Export Service

**File**: `backend/src/api/qdrant-export/services/qdrant-export.ts`

Key methods:
- `exportProduct(productId)` - Export single product
- `deleteProduct(productId)` - Remove from Qdrant
- `bulkExport(filters)` - Bulk export with filters
- `getStats()` - Collection & queue statistics
- `search(query, limit, filter)` - Test semantic search
- `recreateCollection()` - Admin: drop & recreate

#### 3.2 Create API Endpoints

**Routes** (`backend/src/api/qdrant-export/routes/qdrant-export.ts`):
- POST `/api/qdrant-export/bulk` - Bulk enqueue
- POST `/api/qdrant-export/product/:id` - Single export
- GET `/api/qdrant-export/stats` - Statistics
- GET `/api/qdrant-export/search` - Test search
- POST `/api/qdrant-export/collection/recreate` - Admin only

**Controller** (`backend/src/api/qdrant-export/controllers/qdrant-export.ts`):
- Thin HTTP layer
- Validation & error handling
- Call service methods

#### 3.3 Add Cron Jobs

**File**: `backend/config/cron.ts`

**Daily Full Sync** (3:00 AM):
```typescript
nightlyQdrantSync: {
  task: async ({ strapi }) => {
    // Enqueue all active products
  },
  options: { rule: '0 3 * * *', tz: 'Europe/Amsterdam' }
}
```

**12-Hour Incremental** (3:00 AM & 3:00 PM):
```typescript
twelveHourQdrantIncremental: {
  task: async ({ strapi }) => {
    // Enqueue products updated in last 12 hours
  },
  options: { rule: '0 3,15 * * *', tz: 'Europe/Amsterdam' }
}
```

---

### Phase 4: Testing & Polish (Day 4)

#### 4.1 Testing

**Unit Tests**:
- Qdrant client (connection, upsert, search)
- Embedding service (generate, cache, cost tracking)
- Product transformer (transform, multilingual, embedding text)

**Integration Tests**:
- Single product export end-to-end
- Bulk export (100 products)
- Search functionality
- Cron job simulation

**Performance Benchmarks**:
- Single export: < 1 second
- Bulk export: 1000 products in ~15 minutes
- Search latency: < 100ms
- Queue throughput: 300+ products/hour

#### 4.2 Documentation

Create comprehensive docs with:
- Architecture overview
- API endpoints
- Environment setup
- Troubleshooting guide
- Cost analysis

#### 4.3 Deployment Preparation

- Environment variables configured
- Qdrant instance running (local or cloud)
- Initial collection creation
- Test exports verified

---

## Technical Specifications

### API Endpoints

#### POST `/api/qdrant-export/bulk`
Bulk enqueue all active products for export.

**Request**:
```json
{
  "filters": {
    "supplierCode": "A113"
  },
  "limit": 1000
}
```

**Response**:
```json
{
  "success": true,
  "message": "Enqueued 750 products for Qdrant export",
  "data": {
    "total": 750,
    "enqueued": 750,
    "skipped": 0
  }
}
```

#### GET `/api/qdrant-export/stats`
Get Qdrant collection and queue statistics.

**Response**:
```json
{
  "success": true,
  "data": {
    "collection": {
      "name": "products",
      "vectors_count": 750,
      "status": "green"
    },
    "queue": {
      "waiting": 0,
      "active": 3,
      "completed": 747,
      "failed": 0
    },
    "embedding_cache": {
      "size": 150,
      "memoryEstimate": "~1.78 KB"
    }
  }
}
```

### Qdrant Collection Schema

```typescript
{
  collection_name: "products",
  vectors: {
    size: 1536,        // OpenAI text-embedding-3-small
    distance: "Cosine"
  },
  payload_index: {
    supplierCode: "keyword",
    category: "keyword"
  }
}
```

### Vector Point Structure

```typescript
{
  id: "product-123",
  vector: [0.1, 0.2, ...], // 1536 dimensions
  payload: {
    sku: "A113-001",
    productId: 123,
    supplierId: 1,
    supplierCode: "A113",
    name: { en: "T-Shirt", de: "T-Shirt" },
    description: { en: "...", de: "..." },
    category: "Textiles > T-Shirts > Kids",
    available_sizes: ["XS", "S", "M"],
    colors: ["white", "black"],
    price_range: { min: 5.99, max: 12.99 },
    primary_image: "https://...",
    is_active: true,
    last_synced: "2025-01-03T03:00:00Z"
  }
}
```

---

## Migration from AutoRAG

### What to Reuse (70%)

#### 1. Product Transformation Logic
**From**: `autorag.ts:transformProductForAutoRAG()`
**To**: `qdrant/transformers/product-transformer.ts:transformProduct()`

**Reusable**:
- Multilingual field extraction
- Category hierarchy building
- Supplier data mapping
- Industry context generation

#### 2. Batch Processing Pattern
**From**: `autorag.ts:bulkUploadProducts()`
**To**: `qdrant-export/services/qdrant-export.ts:bulkExport()`

**Reusable**:
- Batch size configuration
- Rate limiting delays
- Error tracking
- Progress logging

#### 3. Singleton Service Pattern
**From**: `autorag.ts` class structure
**To**: All Qdrant services

**Reusable**:
- Environment variable validation
- Client initialization
- Error handling approach

### What to Adapt (30%)

#### 1. Storage Mechanism
**From**: Upload JSON files to R2 bucket
**To**: Upsert vector points to Qdrant

#### 2. Data Format
**From**: Flat JSON with metadata
**To**: Vector + payload structure

#### 3. Sync Frequency
**From**: 6-hour batch indexing
**To**: 12-hour incremental via cron

### What NOT to Migrate

1. ❌ R2 file upload logic
2. ❌ AutoRAG-specific API calls
3. ❌ 6-hour indexing wait
4. ❌ A113 hard-coding

---

## Testing Strategy

### Phase 1: Unit Testing

Test files to create:
- `qdrant-client.test.ts`
- `embedding-service.test.ts`
- `product-transformer.test.ts`

### Phase 2: Integration Testing

Test scenarios:
1. Single product export
2. Bulk export (100 products)
3. Search functionality
4. Cron job simulation

### Phase 3: Performance Testing

Benchmarks:
- Single product: < 1 second
- Bulk (1000): ~15 minutes
- Search: < 100ms
- Queue: 300 products/hour

---

## Deployment Checklist

### Pre-Deployment

- [ ] Install Qdrant (local or cloud)
- [ ] Install dependencies (`@qdrant/js-client-rest`, `openai`)
- [ ] Configure environment variables
- [ ] Create directory structure

### Deployment Steps

1. [ ] Deploy code changes
2. [ ] Initialize Qdrant collection
3. [ ] Test single export
4. [ ] Verify cron jobs
5. [ ] Run initial bulk sync

### Post-Deployment

- [ ] Monitor queue
- [ ] Test search
- [ ] Monitor costs
- [ ] Performance monitoring

### Rollback Plan

If issues occur:
1. [ ] Disable cron jobs
2. [ ] Stop queue worker
3. [ ] Revert code changes
4. [ ] Keep Qdrant data intact

---

## Troubleshooting Guide

### Common Issues

#### Issue 1: "Qdrant connection failed"

**Symptoms**: `Error: connect ECONNREFUSED`

**Solutions**:
1. Check Qdrant is running: `docker ps | grep qdrant`
2. Verify `QDRANT_URL` in `.env`
3. Test connection: `curl http://localhost:6333/collections`

#### Issue 2: "OpenAI rate limit exceeded"

**Solutions**:
1. Reduce batch size
2. Add delays between requests
3. Upgrade OpenAI plan
4. Use embedding cache

#### Issue 3: "Queue jobs stuck"

**Solutions**:
1. Check Redis connection
2. Verify worker is running
3. Restart Strapi backend

#### Issue 4: "Search returns irrelevant results"

**Solutions**:
1. Verify embedding text quality
2. Ensure product data is complete
3. Test with different queries
4. Consider fine-tuning

---

## Future Enhancements

### Phase 5: Advanced Features

#### 1. Hybrid Search
Combine vector similarity with keyword filters.

#### 2. Multi-Language Embeddings
Generate separate embeddings for each language.

#### 3. Lifecycle Hooks (Real-Time Sync)
Auto-sync products on create/update/delete.

```typescript
// backend/src/api/product/content-types/product/lifecycles.ts
export default {
  async afterCreate(event) {
    const queueService = strapi.service('api::queue.queue-service');
    await queueService.enqueueQdrantExport(event.result.id, 'upsert');
  }
};
```

#### 4. Local Embedding Model
Use local model instead of OpenAI for cost savings.

```typescript
// npm install @xenova/transformers
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
```

**Benefits**: Free, faster, private
**Trade-offs**: Lower quality, requires GPU

#### 5. Admin UI Panel
Add Qdrant management to Strapi admin:
- View collection stats
- Trigger manual sync
- Test search queries
- Monitor queue status

---

## Appendix

### A. Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QDRANT_URL` | Yes | - | Qdrant instance URL |
| `QDRANT_API_KEY` | No* | - | API key (*cloud only) |
| `QDRANT_COLLECTION` | No | `products` | Collection name |
| `OPENAI_API_KEY` | Yes | - | OpenAI API key |
| `BULLMQ_CONCURRENCY_QDRANT` | No | `5` | Worker concurrency |

### B. File Changes Summary

**New Files** (13 files):
```
src/api/qdrant-export/                    (400 lines)
src/services/qdrant/                      (470 lines)
src/services/queue/workers/qdrant-export-worker.ts (80 lines)
```

**Modified Files** (3 files):
```
src/services/queue/queue-service.ts       (+100 lines)
src/services/queue/worker-manager.ts      (+10 lines)
config/cron.ts                            (+80 lines)
```

**Total**: ~1,140 lines of code

### C. Cron Schedule Reference

| Schedule | Expression | Description |
|----------|-----------|-------------|
| Daily 3 AM | `0 3 * * *` | Full sync |
| Every 12h | `0 3,15 * * *` | Incremental |

### D. Performance Benchmarks

| Metric | Value | Notes |
|--------|-------|-------|
| Single export | 800ms | Including embedding |
| Bulk 1000 | 16 min | 5 concurrency |
| Search | 50ms | Qdrant native |
| Queue | 300/hr | Limited by embeddings |
| Cost per 1000 | $0.01 | OpenAI only |

### E. Cost Analysis

**OpenAI** (text-embedding-3-small):
- Price: $0.02 per 1M tokens
- Average product: ~500 tokens
- 1000 products: $0.01
- Monthly: ~$0.30

**Qdrant Cloud**:
- Free tier: 1GB + 100k vectors
- 1000 products: 12MB (fits free tier)

**Total Monthly**: ~$0.30 (OpenAI only)

---

## Document Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-03 | Initial implementation plan |

---

**END OF DOCUMENT**
