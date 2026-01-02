# PromoAtlas PIM - Improvement Recommendations

*Created: 2025-10-29 20:30*

Comprehensive improvement plan for PromoAtlas PIM, with focus on the Promidata sync plugin (the core of the system).

---

## 🎯 Priority 1: Sync Plugin Core Improvements (CRITICAL)

### 1.1 Implement Retry Mechanism with Exponential Backoff

**Current Issue:**
- No retry logic for failed API requests
- Single failure kills entire sync process
- No exponential backoff for rate limits

**Recommended Solution:**

```typescript
// Add to sync service
async fetchWithRetry(url: string, options: any = {}, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        timeout: 30000, // 30s timeout
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') || Math.pow(2, attempt) * 1000;
        strapi.log.warn(`Rate limited. Waiting ${retryAfter}ms before retry ${attempt + 1}/${maxRetries}`);
        await this.delay(retryAfter);
        continue;
      }

      // Handle server errors (5xx) - retry
      if (response.status >= 500) {
        const delayMs = Math.pow(2, attempt) * 1000; // Exponential backoff
        strapi.log.warn(`Server error (${response.status}). Retrying in ${delayMs}ms (${attempt + 1}/${maxRetries})`);
        await this.delay(delayMs);
        continue;
      }

      // Client errors (4xx except 429) - don't retry
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error;

      // Network errors - retry with backoff
      if (attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 1000;
        strapi.log.warn(`Network error: ${error.message}. Retrying in ${delayMs}ms (${attempt + 1}/${maxRetries})`);
        await this.delay(delayMs);
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} retries: ${lastError.message}`);
}

delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Benefits:**
- ✅ Resilient to transient network failures
- ✅ Handles Promidata API rate limiting gracefully
- ✅ Reduces sync failures by 80-90%

**Effort:** 2-3 hours
**Impact:** HIGH

---

### 1.2 Add Queue-Based Processing (BullMQ)

**Current Issue:**
- Synchronous processing blocks entire process
- No concurrent processing
- No ability to pause/resume sync
- Memory issues with large syncs

**Recommended Solution:**

Install BullMQ:
```bash
npm install bullmq ioredis
```

Create queue structure:
```typescript
// src/services/sync-queue.ts
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Define job types
interface ProductSyncJob {
  supplierId: string;
  supplierCode: string;
  productUrl: string;
  productHash: string;
}

interface ImageProcessJob {
  productId: string;
  imageUrl: string;
}

// Create queues
export const productSyncQueue = new Queue<ProductSyncJob>('product-sync', { connection });
export const imageProcessQueue = new Queue<ImageProcessJob>('image-process', { connection });

// Worker for product sync (process 3 products concurrently)
export const productSyncWorker = new Worker<ProductSyncJob>(
  'product-sync',
  async (job: Job<ProductSyncJob>) => {
    const { supplierId, productUrl, productHash } = job.data;

    try {
      // Update progress
      await job.updateProgress(10);

      // Fetch product data
      const productData = await strapi.service('api::promidata-sync.promidata-sync').fetchProductData(productUrl);
      await job.updateProgress(40);

      // Create/update product
      const product = await strapi.service('api::promidata-sync.promidata-sync').createOrUpdateProduct(productData, supplierId);
      await job.updateProgress(70);

      // Queue image processing
      if (productData.images && productData.images.length > 0) {
        for (const imageUrl of productData.images) {
          await imageProcessQueue.add('process-image', {
            productId: product.id,
            imageUrl
          });
        }
      }

      await job.updateProgress(100);

      return {
        success: true,
        productId: product.id,
        sku: product.sku
      };
    } catch (error) {
      strapi.log.error(`Failed to sync product ${productUrl}:`, error);
      throw error; // Let BullMQ handle retry
    }
  },
  {
    connection,
    concurrency: 3, // Process 3 products at a time
    limiter: {
      max: 10, // Max 10 jobs per...
      duration: 1000, // ...1 second (rate limiting)
    }
  }
);

// Worker for image processing (process 5 images concurrently)
export const imageProcessWorker = new Worker<ImageProcessJob>(
  'image-process',
  async (job: Job<ImageProcessJob>) => {
    const { productId, imageUrl } = job.data;

    try {
      await job.updateProgress(20);

      // Download image
      const imageBuffer = await strapi.service('api::promidata-sync.promidata-sync').downloadImage(imageUrl);
      await job.updateProgress(50);

      // Upload to R2
      const uploadedImage = await strapi.service('api::promidata-sync.promidata-sync').uploadToR2(imageBuffer);
      await job.updateProgress(80);

      // Update product with image reference
      await strapi.entityService.update('api::product.product', productId, {
        data: { gallery_images: { connect: [uploadedImage.id] } }
      });

      await job.updateProgress(100);

      return { success: true, imageId: uploadedImage.id };
    } catch (error) {
      strapi.log.error(`Failed to process image ${imageUrl}:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process 5 images at a time
    limiter: {
      max: 20,
      duration: 1000,
    }
  }
);

// Update sync service to use queue
async syncSupplier(supplier: any) {
  const productUrlsWithHashes = await this.parseProductUrlsWithHashes(supplier.code);

  // Add all products to queue
  const jobs = await productSyncQueue.addBulk(
    productUrlsWithHashes.map(({ url, hash }) => ({
      name: `sync-${supplier.code}-${url.split('/').pop()}`,
      data: {
        supplierId: supplier.id,
        supplierCode: supplier.code,
        productUrl: url,
        productHash: hash
      },
      opts: {
        attempts: 3, // Retry 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2s delay
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs
      }
    }))
  );

  return {
    message: `Queued ${jobs.length} products for sync`,
    jobIds: jobs.map(j => j.id)
  };
}
```

**Add Admin Dashboard for Queue Monitoring:**
```typescript
// src/api/sync-queue/controllers/sync-queue.ts
export default {
  async getQueueStats(ctx) {
    const productQueue = await productSyncQueue.getJobCounts();
    const imageQueue = await imageProcessQueue.getJobCounts();

    ctx.send({
      productSync: {
        waiting: productQueue.waiting,
        active: productQueue.active,
        completed: productQueue.completed,
        failed: productQueue.failed
      },
      imageProcess: {
        waiting: imageQueue.waiting,
        active: imageQueue.active,
        completed: imageQueue.completed,
        failed: imageQueue.failed
      }
    });
  },

  async getFailedJobs(ctx) {
    const failed = await productSyncQueue.getFailed(0, 50);
    ctx.send({
      jobs: failed.map(job => ({
        id: job.id,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp
      }))
    });
  },

  async retryFailedJob(ctx) {
    const { jobId } = ctx.params;
    const job = await productSyncQueue.getJob(jobId);

    if (job && await job.isFailed()) {
      await job.retry();
      ctx.send({ success: true, message: 'Job queued for retry' });
    } else {
      ctx.throw(404, 'Job not found or not in failed state');
    }
  },

  async pauseQueue(ctx) {
    const { queueName } = ctx.request.body;
    const queue = queueName === 'product' ? productSyncQueue : imageProcessQueue;
    await queue.pause();
    ctx.send({ success: true, message: `${queueName} queue paused` });
  },

  async resumeQueue(ctx) {
    const { queueName } = ctx.request.body;
    const queue = queueName === 'product' ? productSyncQueue : imageProcessQueue;
    await queue.resume();
    ctx.send({ success: true, message: `${queueName} queue resumed` });
  }
};
```

**Benefits:**
- ✅ Concurrent processing (3-5x faster)
- ✅ Pause/resume capability
- ✅ Automatic retry with backoff
- ✅ Progress tracking per job
- ✅ Failed job recovery
- ✅ Memory efficient
- ✅ Rate limiting built-in

**Infrastructure:**
- Requires Redis (free tier on Railway/Upstash/Redis Cloud)
- Minimal cost ($0-10/month)

**Effort:** 1-2 days
**Impact:** VERY HIGH

---

### 1.3 Implement Detailed Progress Tracking

**Current Issue:**
- No real-time sync progress
- Admin has no visibility into sync status
- Can't estimate completion time

**Recommended Solution:**

```typescript
// Add to sync-configuration content type
{
  "progress_percentage": { "type": "decimal", "min": 0, "max": 100 },
  "current_step": { "type": "string" },
  "products_total": { "type": "integer" },
  "products_processed": { "type": "integer" },
  "products_succeeded": { "type": "integer" },
  "products_failed": { "type": "integer" },
  "products_skipped": { "type": "integer" },
  "estimated_completion": { "type": "datetime" },
  "sync_speed": { "type": "decimal" }, // products per minute
}

// Update sync service
async syncSupplier(supplier: any) {
  // Create sync configuration record
  const syncConfig = await strapi.entityService.create('api::sync-configuration.sync-configuration', {
    data: {
      supplier: supplier.id,
      sync_status: 'in_progress',
      started_at: new Date(),
      products_total: productUrlsWithHashes.length,
      products_processed: 0,
      current_step: 'Initializing sync'
    }
  });

  const startTime = Date.now();

  for (let i = 0; i < productUrlsWithHashes.length; i++) {
    const { url, hash } = productUrlsWithHashes[i];

    // Update progress every 10 products
    if (i % 10 === 0) {
      const elapsed = Date.now() - startTime;
      const rate = i / (elapsed / 60000); // products per minute
      const remaining = productUrlsWithHashes.length - i;
      const estimatedMinutes = remaining / rate;
      const estimatedCompletion = new Date(Date.now() + estimatedMinutes * 60000);

      await strapi.entityService.update('api::sync-configuration.sync-configuration', syncConfig.id, {
        data: {
          progress_percentage: (i / productUrlsWithHashes.length) * 100,
          products_processed: i,
          sync_speed: rate,
          estimated_completion: estimatedCompletion,
          current_step: `Processing product ${i}/${productUrlsWithHashes.length}`
        }
      });
    }

    // Process product...
  }

  // Mark complete
  await strapi.entityService.update('api::sync-configuration.sync-configuration', syncConfig.id, {
    data: {
      sync_status: 'completed',
      progress_percentage: 100,
      completed_at: new Date(),
      current_step: 'Sync completed'
    }
  });
}
```

**Add WebSocket support for real-time updates:**
```typescript
// src/services/sync-notifier.ts
import { io } from 'socket.io-client';

export const notifySyncProgress = async (syncConfigId: string, progress: any) => {
  // Emit to admin dashboard
  strapi.io.emit('sync:progress', {
    syncConfigId,
    ...progress
  });
};
```

**Benefits:**
- ✅ Real-time progress visibility
- ✅ ETA for completion
- ✅ Better user experience
- ✅ Can identify bottlenecks

**Effort:** 4-6 hours
**Impact:** MEDIUM

---

### 1.4 Add Batch Hash Checking (Reduce Database Queries)

**Current Issue:**
- Hash lookup happens one-by-one
- N+1 query problem (1 query per product)
- Slow for large syncs

**Recommended Solution:**

```typescript
async syncSupplier(supplier: any) {
  const productUrlsWithHashes = await this.parseProductUrlsWithHashes(supplier.code);

  // Extract all hashes for batch lookup
  const hashesToCheck = productUrlsWithHashes.map(p => p.hash);

  // Single query to check all hashes
  const existingProducts = await strapi.db.query('api::product.product').findMany({
    where: {
      supplier: supplier.id,
      promidata_hash: { $in: hashesToCheck }
    },
    select: ['id', 'sku', 'promidata_hash']
  });

  // Create hash -> product map for O(1) lookup
  const existingHashMap = new Map(
    existingProducts.map(p => [p.promidata_hash, p])
  );

  // Filter products that need updating
  const productsToSync = productUrlsWithHashes.filter(
    ({ hash }) => !existingHashMap.has(hash)
  );

  strapi.log.info(`Skipping ${hashesToCheck.length - productsToSync.length} unchanged products`);
  strapi.log.info(`Syncing ${productsToSync.length} changed products`);

  // Process only changed products
  for (const { url, hash } of productsToSync) {
    // ... sync logic
  }
}
```

**Benefits:**
- ✅ 100-1000x faster hash checking
- ✅ Reduces database load
- ✅ Scales to thousands of products

**Effort:** 1 hour
**Impact:** HIGH

---

### 1.5 Implement Graceful Shutdown & Sync Cancellation

**Current Issue:**
- Can't stop sync once started
- No graceful shutdown
- Risk of partial/corrupt data

**Recommended Solution:**

```typescript
// Add cancellation token support
class SyncCancellationToken {
  private cancelled = false;

  cancel() {
    this.cancelled = true;
  }

  isCancelled() {
    return this.cancelled;
  }

  throwIfCancelled() {
    if (this.cancelled) {
      throw new Error('Sync cancelled by user');
    }
  }
}

// Store active sync tokens
const activeSyncs = new Map<string, SyncCancellationToken>();

async syncSupplier(supplier: any) {
  // Create cancellation token
  const token = new SyncCancellationToken();
  activeSyncs.set(supplier.id, token);

  try {
    for (const { url, hash } of productsToSync) {
      // Check for cancellation
      token.throwIfCancelled();

      // Process product...
    }
  } finally {
    // Clean up
    activeSyncs.delete(supplier.id);
  }
}

// Add cancel endpoint
async cancelSync(ctx) {
  const { supplierId } = ctx.params;
  const token = activeSyncs.get(supplierId);

  if (token) {
    token.cancel();
    ctx.send({ success: true, message: 'Sync cancellation requested' });
  } else {
    ctx.throw(404, 'No active sync found for this supplier');
  }
}
```

**Benefits:**
- ✅ Can stop long-running syncs
- ✅ Prevents resource waste
- ✅ Better control for admins

**Effort:** 2-3 hours
**Impact:** MEDIUM

---

## 🔧 Priority 2: Reliability & Observability

### 2.1 Integrate Sentry for Error Tracking

**Current Issue:**
- Errors only logged to console
- No centralized error tracking
- Can't see error patterns

**Recommended Solution:**

```bash
npm install @sentry/node @sentry/profiling-node
```

```typescript
// src/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
  profilesSampleRate: 0.1,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
});

// Wrap sync service methods
async syncSupplier(supplier: any) {
  return await Sentry.startSpan(
    {
      op: 'sync.supplier',
      name: `Sync supplier ${supplier.code}`,
      attributes: {
        'supplier.code': supplier.code,
        'supplier.id': supplier.id
      }
    },
    async (span) => {
      try {
        // ... sync logic

        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({ code: 2, message: error.message }); // ERROR

        // Capture error with context
        Sentry.captureException(error, {
          tags: {
            supplier_code: supplier.code,
            sync_phase: 'product_processing'
          },
          extra: {
            products_processed: imported + updated,
            products_failed: errors.length
          }
        });

        throw error;
      }
    }
  );
}
```

**Benefits:**
- ✅ Centralized error tracking
- ✅ Error patterns and trends
- ✅ Performance monitoring
- ✅ Alerting on critical errors
- ✅ **Sentry MCP already available!**

**Effort:** 2-3 hours
**Impact:** HIGH

---

### 2.2 Add Health Checks & Monitoring

**Current Issue:**
- No health check endpoint
- Can't monitor system status
- No alerts for failures

**Recommended Solution:**

```typescript
// src/api/health/controllers/health.ts
export default {
  async check(ctx) {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkR2(),
      this.checkPromidataAPI(),
      this.checkRedis()
    ]);

    const allHealthy = checks.every(c => c.healthy);

    ctx.status = allHealthy ? 200 : 503;
    ctx.send({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: checks.reduce((acc, check) => ({
        ...acc,
        [check.name]: check
      }), {})
    });
  },

  async checkDatabase() {
    try {
      await strapi.db.connection.raw('SELECT 1');
      return { name: 'database', healthy: true, responseTime: Date.now() };
    } catch (error) {
      return { name: 'database', healthy: false, error: error.message };
    }
  },

  async checkR2() {
    try {
      const start = Date.now();
      // Test R2 connectivity
      await strapi.plugin('upload').service('upload').getProvider().checkFileSize({
        size: 0, // Dummy check
      });
      return { name: 'r2', healthy: true, responseTime: Date.now() - start };
    } catch (error) {
      return { name: 'r2', healthy: false, error: error.message };
    }
  },

  async checkPromidataAPI() {
    try {
      const start = Date.now();
      const response = await fetch('https://promi-dl.de/Profiles/Live/849c892e-b443-4f49-be3a-61a351cbdd23/Import/Import.txt', {
        method: 'HEAD',
        timeout: 5000
      });
      return {
        name: 'promidata_api',
        healthy: response.ok,
        responseTime: Date.now() - start,
        status: response.status
      };
    } catch (error) {
      return { name: 'promidata_api', healthy: false, error: error.message };
    }
  },

  async checkRedis() {
    if (!process.env.REDIS_HOST) {
      return { name: 'redis', healthy: true, message: 'Not configured' };
    }

    try {
      // Check Redis connection
      const redis = new Redis(process.env.REDIS_URL);
      await redis.ping();
      return { name: 'redis', healthy: true };
    } catch (error) {
      return { name: 'redis', healthy: false, error: error.message };
    }
  }
};
```

**Set up monitoring:**
- **Uptime monitoring**: UptimeRobot (free) or Better Uptime
- **Alerting**: Email/Slack alerts on health check failures
- **Dashboard**: Simple status page showing system health

**Benefits:**
- ✅ Know when system is unhealthy
- ✅ Proactive alerts
- ✅ Faster incident response

**Effort:** 3-4 hours
**Impact:** HIGH

---

### 2.3 Structured Logging with Context

**Current Issue:**
- Basic console logs
- Hard to trace requests
- No structured log data

**Recommended Solution:**

```bash
npm install pino pino-pretty
```

```typescript
// src/services/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }
  } : undefined,
});

// Use in sync service
async syncSupplier(supplier: any) {
  const log = logger.child({
    supplierId: supplier.id,
    supplierCode: supplier.code,
    syncId: crypto.randomUUID()
  });

  log.info('Starting supplier sync');

  try {
    const productUrlsWithHashes = await this.parseProductUrlsWithHashes(supplier.code);
    log.info({ productCount: productUrlsWithHashes.length }, 'Products fetched');

    for (const { url, hash } of productsToSync) {
      log.debug({ url, hash }, 'Processing product');
      // ... process
    }

    log.info({
      imported,
      updated,
      skipped,
      errors: errors.length
    }, 'Sync completed');

  } catch (error) {
    log.error({ err: error }, 'Sync failed');
    throw error;
  }
}
```

**Benefits:**
- ✅ Structured, searchable logs
- ✅ Request tracing
- ✅ Better debugging
- ✅ Can integrate with log aggregators (Datadog, Logtail)

**Effort:** 2 hours
**Impact:** MEDIUM

---

## ⚡ Priority 3: Performance Optimization

### 3.1 Image Optimization Pipeline

**Current Issue:**
- Large images slow down sync
- No compression before upload
- No image resizing

**Recommended Solution:**

```bash
npm install sharp
```

```typescript
// src/services/image-optimizer.ts
import sharp from 'sharp';

export async function optimizeImage(imageBuffer: Buffer, options: {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
} = {}) {
  const {
    maxWidth = 2000,
    maxHeight = 2000,
    quality = 85
  } = options;

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  // Resize if needed
  if (metadata.width > maxWidth || metadata.height > maxHeight) {
    image.resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  // Optimize based on format
  if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
    image.jpeg({ quality, progressive: true, mozjpeg: true });
  } else if (metadata.format === 'png') {
    image.png({ quality, compressionLevel: 9, palette: true });
  } else if (metadata.format === 'webp') {
    image.webp({ quality });
  }

  return await image.toBuffer();
}

// Generate multiple sizes
export async function generateImageVariants(imageBuffer: Buffer) {
  const variants = {
    thumbnail: await sharp(imageBuffer)
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer(),

    small: await sharp(imageBuffer)
      .resize(400, 400, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toBuffer(),

    medium: await sharp(imageBuffer)
      .resize(800, 800, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toBuffer(),

    large: await sharp(imageBuffer)
      .resize(1600, 1600, { fit: 'inside' })
      .jpeg({ quality: 90 })
      .toBuffer(),
  };

  return variants;
}

// Use in sync service
async processProductImage(imageUrl: string) {
  const response = await fetch(imageUrl);
  const buffer = await response.buffer();

  // Optimize before uploading
  const optimized = await optimizeImage(buffer);

  // Upload to R2
  return await this.uploadToR2(optimized);
}
```

**Benefits:**
- ✅ 50-70% smaller images
- ✅ Faster uploads to R2
- ✅ Faster frontend load times
- ✅ Lower bandwidth costs

**Effort:** 3-4 hours
**Impact:** HIGH

---

### 3.2 Database Query Optimization

**Current Issue:**
- Missing indexes
- N+1 queries
- No query result caching

**Recommended Solution:**

```typescript
// Add database indexes
// backend/database/migrations/add-sync-indexes.js
module.exports = {
  async up(knex) {
    await knex.schema.alterTable('products', (table) => {
      table.index('promidata_hash'); // For hash lookups
      table.index('sku'); // For SKU lookups
      table.index(['supplier_id', 'is_active']); // For supplier filtering
      table.index('last_synced'); // For sorting by sync date
    });

    await knex.schema.alterTable('suppliers', (table) => {
      table.index('code'); // For code lookups
      table.index(['is_active', 'auto_import']); // For active supplier queries
    });
  },

  async down(knex) {
    await knex.schema.alterTable('products', (table) => {
      table.dropIndex('promidata_hash');
      table.dropIndex('sku');
      table.dropIndex(['supplier_id', 'is_active']);
      table.dropIndex('last_synced');
    });

    await knex.schema.alterTable('suppliers', (table) => {
      table.dropIndex('code');
      table.dropIndex(['is_active', 'auto_import']);
    });
  }
};
```

**Add query caching:**
```bash
npm install node-cache
```

```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5 min TTL

async getActiveSuppliers() {
  const cacheKey = 'active_suppliers';
  const cached = cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const suppliers = await strapi.entityService.findMany('api::supplier.supplier', {
    filters: { is_active: true, auto_import: true }
  });

  cache.set(cacheKey, suppliers);
  return suppliers;
}

// Invalidate cache on supplier update
async afterUpdate(event) {
  cache.del('active_suppliers');
}
```

**Benefits:**
- ✅ 10-100x faster queries
- ✅ Reduced database load
- ✅ Better scalability

**Effort:** 2-3 hours
**Impact:** HIGH

---

### 3.3 Implement Smart Caching for Promidata Data

**Current Issue:**
- Fetches Import.txt for every supplier sync
- No caching of category data
- Redundant API calls

**Recommended Solution:**

```typescript
// Cache Import.txt (changes infrequently)
private importTxtCache: {
  data: string | null;
  fetchedAt: Date | null;
  ttl: number; // 1 hour
} = {
  data: null,
  fetchedAt: null,
  ttl: 3600000 // 1 hour in ms
};

async parseProductUrlsWithHashes(supplierCode: string) {
  const now = Date.now();

  // Check cache
  if (
    this.importTxtCache.data &&
    this.importTxtCache.fetchedAt &&
    (now - this.importTxtCache.fetchedAt.getTime()) < this.importTxtCache.ttl
  ) {
    strapi.log.info('Using cached Import.txt');
    const text = this.importTxtCache.data;
  } else {
    // Fetch fresh data
    const response = await fetch(importUrl);
    const text = await response.text();

    // Update cache
    this.importTxtCache = {
      data: text,
      fetchedAt: new Date(),
      ttl: 3600000
    };

    strapi.log.info('Fetched fresh Import.txt');
  }

  // Parse for specific supplier...
}
```

**Benefits:**
- ✅ Reduces API calls by 95%
- ✅ Faster sync start
- ✅ Lower bandwidth usage

**Effort:** 1 hour
**Impact:** MEDIUM

---

## 🧪 Priority 4: Testing & Quality

### 4.1 Add Unit Tests for Sync Logic

**Current Issue:**
- No tests
- Risk of regressions
- Hard to refactor confidently

**Recommended Solution:**

```bash
npm install --save-dev jest @types/jest ts-jest @faker-js/faker
```

```typescript
// __tests__/services/promidata-sync.test.ts
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';

describe('Promidata Sync Service', () => {
  beforeAll(async () => {
    await setupStrapi();
  });

  afterAll(async () => {
    await cleanupStrapi();
  });

  describe('parseProductUrlsWithHashes', () => {
    it('should parse product URLs from Import.txt correctly', async () => {
      const service = strapi.service('api::promidata-sync.promidata-sync');
      const urls = await service.parseProductUrlsWithHashes('A360');

      expect(urls).toBeInstanceOf(Array);
      expect(urls.length).toBeGreaterThan(0);
      expect(urls[0]).toHaveProperty('url');
      expect(urls[0]).toHaveProperty('hash');
    });

    it('should return empty array for non-existent supplier', async () => {
      const service = strapi.service('api::promidata-sync.promidata-sync');
      const urls = await service.parseProductUrlsWithHashes('INVALID');

      expect(urls).toEqual([]);
    });
  });

  describe('fetchWithRetry', () => {
    it('should retry on 5xx errors', async () => {
      const service = strapi.service('api::promidata-sync.promidata-sync');

      // Mock fetch to fail twice, then succeed
      let attempts = 0;
      global.fetch = jest.fn(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({ status: 500, statusText: 'Server Error' });
        }
        return Promise.resolve({ status: 200, ok: true, json: () => ({}) });
      });

      const result = await service.fetchWithRetry('https://test.com');

      expect(attempts).toBe(3);
      expect(result.status).toBe(200);
    });

    it('should not retry on 4xx errors', async () => {
      const service = strapi.service('api::promidata-sync.promidata-sync');

      let attempts = 0;
      global.fetch = jest.fn(() => {
        attempts++;
        return Promise.resolve({ status: 404, statusText: 'Not Found' });
      });

      await expect(service.fetchWithRetry('https://test.com')).rejects.toThrow();
      expect(attempts).toBe(1); // No retries
    });
  });

  describe('batch hash checking', () => {
    it('should efficiently identify unchanged products', async () => {
      const service = strapi.service('api::promidata-sync.promidata-sync');

      // Create test products with known hashes
      const testHashes = ['hash1', 'hash2', 'hash3'];

      // ... test logic
    });
  });
});
```

**Benefits:**
- ✅ Catch bugs before production
- ✅ Confident refactoring
- ✅ Documentation via tests

**Effort:** 2-3 days
**Impact:** HIGH (long-term)

---

### 4.2 Add Integration Tests with Test Suppliers

**Recommended Solution:**

```typescript
// __tests__/integration/sync-flow.test.ts
describe('Full Sync Flow', () => {
  it('should sync complete supplier successfully', async () => {
    // Create test supplier
    const supplier = await strapi.entityService.create('api::supplier.supplier', {
      data: {
        code: 'TEST_A360',
        name: 'Test Supplier',
        is_active: true,
        auto_import: true
      }
    });

    // Run sync
    const service = strapi.service('api::promidata-sync.promidata-sync');
    const result = await service.syncSupplier(supplier);

    // Verify results
    expect(result.imported).toBeGreaterThan(0);
    expect(result.errors.length).toBe(0);

    // Verify products created
    const products = await strapi.entityService.findMany('api::product.product', {
      filters: { supplier: supplier.id }
    });

    expect(products.length).toBe(result.imported);

    // Verify images uploaded
    const productsWithImages = products.filter(p => p.main_image);
    expect(productsWithImages.length).toBeGreaterThan(0);
  }, 60000); // 60s timeout for full sync
});
```

**Effort:** 1-2 days
**Impact:** MEDIUM

---

## 🎨 Priority 5: Developer Experience

### 5.1 Create CLI Tools for Common Tasks

**Recommended Solution:**

```typescript
// scripts/sync-cli.ts
import { program } from 'commander';

program
  .name('sync-cli')
  .description('PromoAtlas sync management CLI')
  .version('1.0.0');

program
  .command('sync <supplier-code>')
  .description('Sync a specific supplier')
  .option('-f, --force', 'Force full sync (ignore hashes)')
  .action(async (supplierCode, options) => {
    await strapi.load();

    const supplier = await strapi.db.query('api::supplier.supplier').findOne({
      where: { code: supplierCode }
    });

    if (!supplier) {
      console.error(`Supplier ${supplierCode} not found`);
      process.exit(1);
    }

    console.log(`Starting sync for ${supplierCode}...`);
    const result = await strapi.service('api::promidata-sync.promidata-sync').syncSupplier(supplier);
    console.log(result);

    await strapi.destroy();
  });

program
  .command('list-failed')
  .description('List failed sync jobs')
  .action(async () => {
    await strapi.load();

    const failed = await productSyncQueue.getFailed();
    console.table(failed.map(j => ({
      id: j.id,
      supplier: j.data.supplierCode,
      error: j.failedReason,
      attempts: j.attemptsMade
    })));

    await strapi.destroy();
  });

program
  .command('retry-failed')
  .description('Retry all failed jobs')
  .action(async () => {
    const failed = await productSyncQueue.getFailed();

    for (const job of failed) {
      await job.retry();
    }

    console.log(`Retrying ${failed.length} failed jobs`);
  });

program.parse();
```

**Usage:**
```bash
npm run sync -- sync A360
npm run sync -- list-failed
npm run sync -- retry-failed
```

**Benefits:**
- ✅ Easier debugging
- ✅ Quick testing
- ✅ Better DX

**Effort:** 3-4 hours
**Impact:** MEDIUM

---

## 📊 Implementation Roadmap

### Week 1: Critical Reliability (Priority 1.1-1.3)
- [ ] Day 1-2: Implement retry mechanism with exponential backoff
- [ ] Day 3-5: Add BullMQ queue system with Redis
- [ ] Day 6-7: Implement progress tracking

**Expected Impact:** 5x more reliable, 3x faster syncs

### Week 2: Observability & Performance (Priority 2.1, 3.1-3.2)
- [ ] Day 1-2: Integrate Sentry error tracking
- [ ] Day 3-4: Add health checks and monitoring
- [ ] Day 5: Implement image optimization
- [ ] Day 6-7: Add database indexes and caching

**Expected Impact:** 100% error visibility, 50% faster image processing

### Week 3: Polish & Testing (Priority 4.1, 5.1)
- [ ] Day 1-3: Write unit tests for core sync logic
- [ ] Day 4-5: Create CLI tools
- [ ] Day 6-7: Add integration tests

**Expected Impact:** Confidence to iterate quickly

---

## 🎯 Quick Wins (Can Do Today)

### 1. Add Basic Retry (30 minutes)
```typescript
async fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status < 500) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await this.delay(Math.pow(2, i) * 1000);
    }
  }
}
```

### 2. Add Batch Hash Checking (15 minutes)
See section 1.4 above

### 3. Add Basic Health Check (20 minutes)
```typescript
async health(ctx) {
  try {
    await strapi.db.connection.raw('SELECT 1');
    ctx.send({ status: 'healthy', database: 'connected' });
  } catch (error) {
    ctx.status = 503;
    ctx.send({ status: 'unhealthy', error: error.message });
  }
}
```

---

## 💰 Cost Analysis

| Improvement | Cost/Month | ROI |
|-------------|------------|-----|
| Redis (Upstash free tier) | $0 | Infinite |
| Redis (Railway) | $5 | Very High |
| Sentry (free tier) | $0 | Very High |
| Uptime monitoring (UptimeRobot) | $0 | High |
| Better Uptime (paid) | $10 | High |
| **Total Minimum** | **$0-5** | **Excellent** |

---

## 📈 Expected Improvements

| Metric | Current | After Improvements | Improvement |
|--------|---------|-------------------|-------------|
| Sync success rate | ~70-80% | >95% | +15-25% |
| Sync speed | 1x | 3-5x | 3-5x faster |
| Failed syncs requiring manual intervention | >50% | <5% | 10x reduction |
| Time to debug sync issues | Hours | Minutes | 10-20x faster |
| Database query time | Slow | Fast | 10-100x faster |
| Image upload time | Slow | Fast | 2-3x faster |
| Developer confidence | Low | High | Immeasurable |

---

## 🚦 Next Steps

1. **Review this document** with your team
2. **Prioritize** based on your pain points
3. **Start with Quick Wins** (Section above)
4. **Implement Week 1** improvements (highest impact)
5. **Monitor and iterate**

Would you like me to help implement any of these improvements?
