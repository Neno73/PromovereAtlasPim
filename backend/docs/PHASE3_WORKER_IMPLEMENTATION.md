# Phase 3: Worker Implementation Plan

**Status:** In Progress
**Start Date:** 2025-10-29
**Branch:** feature/phase3-worker-implementation

## Overview

Phase 3 implements BullMQ workers to handle background job processing for Promidata sync operations. This moves sync processing from direct execution to a queue-based architecture, enabling:

- **Scalability**: Multiple workers can process jobs in parallel
- **Reliability**: Failed jobs are automatically retried with exponential backoff
- **Observability**: Job progress tracking and monitoring
- **Resilience**: Jobs persist in Redis even if the application crashes

## Architecture

```
┌─────────────────┐
│  API Request    │
│  (startSync)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Queue Service   │  Enqueues jobs to Redis
│  (Orchestrator) │
└────────┬────────┘
         │
         ▼
   ┌───────────┐
   │   Redis   │  BullMQ queues store jobs
   └─────┬─────┘
         │
    ┌────┴────┐────────────┐
    ▼         ▼            ▼
┌─────────┐ ┌──────┐ ┌────────┐
│Supplier │ │Family│ │ Image  │  Workers process jobs
│ Worker  │ │Worker│ │ Worker │
└─────────┘ └──────┘ └────────┘
```

## Implementation Steps

### Step 1: Create Worker Files ✅
Create three worker implementations:

1. **`src/services/queue/workers/supplier-sync-worker.ts`**
   - Processes supplier sync jobs
   - Concurrency: 1 (sequential processing)
   - Timeout: 30 minutes
   - Enqueues product family jobs

2. **`src/services/queue/workers/product-family-worker.ts`**
   - Processes product family jobs
   - Concurrency: 3 (parallel processing)
   - Timeout: 5 minutes
   - Enqueues image upload jobs

3. **`src/services/queue/workers/image-upload-worker.ts`**
   - Processes image upload jobs
   - Concurrency: 10 (high parallelism)
   - Timeout: 2 minutes
   - Uploads images to R2

### Step 2: Create Queue Service ✅
Create `src/services/queue/queue-service.ts`:
- Manages Queue instances for all three queues
- Provides methods to enqueue jobs
- Exposes queue statistics and monitoring

### Step 3: Create Worker Manager ✅
Create `src/services/queue/worker-manager.ts`:
- Manages worker lifecycle (start/stop)
- Registers all workers
- Handles graceful shutdown
- Integrates with Strapi bootstrap/destroy

### Step 4: Update Orchestration Service ✅
Modify `src/api/promidata-sync/services/promidata-sync.ts`:
- Replace direct processing with job enqueueing
- Add job status tracking methods
- Provide endpoints for monitoring sync progress

### Step 5: Add Strapi Integration ✅
Update Strapi lifecycle hooks:
- Start workers on `register` or `bootstrap`
- Stop workers on `destroy` (graceful shutdown)
- Ensure proper cleanup on application exit

### Step 6: Testing & Validation ✅
- Test individual workers
- Test end-to-end sync flow
- Test retry logic for failed jobs
- Test graceful shutdown

## Queue Definitions

### Supplier Sync Queue
**Queue Name:** `supplier-sync`
**Job Data:**
```typescript
{
  supplierId: string;      // Supplier documentId
  supplierCode: string;    // For logging
  manual: boolean;         // Manual vs scheduled sync
}
```

**Worker Responsibilities:**
1. Parse Import.txt for supplier
2. Fetch variant data
3. Group by a_number
4. Perform batch hash check
5. Enqueue product family jobs for changed products
6. Update supplier sync status

### Product Family Queue
**Queue Name:** `product-family`
**Job Data:**
```typescript
{
  aNumber: string;           // Product family identifier
  variants: VariantData[];   // All variants in family
  supplierId: number;        // Numeric supplier ID
  supplierCode: string;      // For logging
  productHash: string;       // For incremental sync
}
```

**Worker Responsibilities:**
1. Transform product data
2. Create/update Product entity
3. Transform variant data
4. Create/update ProductVariant entities
5. Enqueue image upload jobs

### Image Upload Queue
**Queue Name:** `image-upload`
**Job Data:**
```typescript
{
  imageUrl: string;          // Source URL
  fileName: string;          // Target filename
  entityType: 'product' | 'product-variant';
  entityId: number;          // Product or variant ID
  fieldName: 'primary_image' | 'gallery_images';
  index?: number;            // Gallery image index
}
```

**Worker Responsibilities:**
1. Check for existing image (deduplication)
2. Download image from Promidata
3. Upload to R2
4. Create Strapi media record
5. Update entity relation

## Job Flow Example

```
User triggers sync for supplier A23
    │
    ▼
[Queue Service] Enqueues supplier-sync job
    │
    ▼
[Supplier Worker] Processes A23
    │
    ├─ Finds 50 product families
    ├─ Hash check: 10 changed
    │
    ▼
[Queue Service] Enqueues 10 product-family jobs
    │
    ▼
[Family Worker] (x3 concurrent) Processes families
    │
    ├─ Family 1: Product + 5 variants
    ├─ Each variant has 3 images
    │
    ▼
[Queue Service] Enqueues 15 image-upload jobs
    │
    ▼
[Image Worker] (x10 concurrent) Uploads images
    │
    └─ All images uploaded

Sync complete!
```

## Progress Tracking

Each worker updates job progress:

```typescript
await job.updateProgress({
  step: 'parsing_import',
  completed: 50,
  total: 100,
  message: 'Parsing Import.txt...'
});
```

The orchestration service can query job status:
```typescript
const job = await queueService.getJob('supplier-sync', jobId);
const progress = job.progress;
```

## Error Handling

### Retry Strategy
- **Supplier Sync**: 2 attempts, exponential backoff (30s, 60s)
- **Product Family**: 3 attempts, exponential backoff (10s, 20s, 40s)
- **Image Upload**: 5 attempts, fixed backoff (30s)

### Failed Job Handling
- Failed jobs remain in queue for 7 days
- Can be manually retried via admin dashboard
- Error details logged to Strapi

### Partial Failure Recovery
- Product family failures don't block other families
- Image upload failures don't block product creation
- Each job is independent and retryable

## Configuration

### Environment Variables
```env
# Redis connection (required)
REDIS_URL=redis://localhost:6379

# Worker concurrency (optional)
BULLMQ_CONCURRENCY_FAMILIES=3
BULLMQ_CONCURRENCY_IMAGES=10

# Job timeouts (optional, in milliseconds)
BULLMQ_JOB_TIMEOUT_SUPPLIER=1800000  # 30 minutes
BULLMQ_JOB_TIMEOUT_FAMILY=300000     # 5 minutes
BULLMQ_JOB_TIMEOUT_IMAGE=120000      # 2 minutes
```

## Monitoring & Observability

### Queue Statistics
```typescript
const stats = await queueService.getQueueStats('supplier-sync');
// Returns: { waiting, active, completed, failed, delayed }
```

### Worker Health
```typescript
const health = await workerManager.getHealth();
// Returns: { workers: [...], queues: [...], status: 'healthy' }
```

### Job Logs
All job events are logged:
- Job started
- Progress updates
- Job completed
- Job failed (with error)

## Files to Create

1. `src/services/queue/workers/supplier-sync-worker.ts` (new)
2. `src/services/queue/workers/product-family-worker.ts` (new)
3. `src/services/queue/workers/image-upload-worker.ts` (new)
4. `src/services/queue/queue-service.ts` (new)
5. `src/services/queue/worker-manager.ts` (new)
6. `src/index.ts` (modify - add worker lifecycle)

## Files to Modify

1. `src/api/promidata-sync/services/promidata-sync.ts`
   - Replace direct processing with queue enqueuing
   - Add job status methods

## Success Criteria

- ✅ All three workers implemented and functional
- ✅ Queue service manages all queues
- ✅ Worker manager handles lifecycle
- ✅ Orchestration service uses queues
- ✅ Jobs can be tracked and monitored
- ✅ Failed jobs are retried automatically
- ✅ Graceful shutdown works correctly
- ✅ End-to-end sync flow completes successfully

## Next Phase

After Phase 3 completion:
- **Phase 4**: Admin dashboard for queue monitoring
- **Phase 5**: Scheduled syncs (cron jobs)
- **Phase 6**: Performance optimization (indexes, caching)

---

**Implementation Date:** 2025-10-29
**Implemented by:** Claude Code
