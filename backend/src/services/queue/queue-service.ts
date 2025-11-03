/**
 * Queue Service
 * Central service for managing all BullMQ queues
 *
 * Responsibilities:
 * 1. Create and manage Queue instances
 * 2. Provide methods to enqueue jobs
 * 3. Expose queue statistics and monitoring
 * 4. Handle queue cleanup and lifecycle
 */

import { Queue, Job, JobsOptions } from 'bullmq';
import {
  defaultQueueOptions,
  supplierSyncJobOptions,
  productFamilyJobOptions,
  imageUploadJobOptions,
  generateJobId
} from './queue-config';

import type { SupplierSyncJobData } from './workers/supplier-sync-worker';
import type { ProductFamilyJobData } from './workers/product-family-worker';
import type { ImageUploadJobData } from './workers/image-upload-worker';

/**
 * Queue Service Class
 */
class QueueService {
  private supplierSyncQueue: Queue<SupplierSyncJobData> | null = null;
  private productFamilyQueue: Queue<ProductFamilyJobData> | null = null;
  private imageUploadQueue: Queue<ImageUploadJobData> | null = null;
  private initialized: boolean = false;

  /**
   * Check if queue service is initialized
   */
  public get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure queue service is initialized
   * @throws Error if not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'Queue service not initialized. Please ensure workers are started during bootstrap. ' +
        'Check Redis connection and initialization logs.'
      );
    }
  }

  /**
   * Initialize all queues
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      strapi.log.warn('Queue service already initialized, skipping...');
      return;
    }

    strapi.log.info('🚀 Initializing queue service...');

    this.supplierSyncQueue = new Queue<SupplierSyncJobData>(
      'supplier-sync',
      defaultQueueOptions
    );

    this.productFamilyQueue = new Queue<ProductFamilyJobData>(
      'product-family',
      defaultQueueOptions
    );

    this.imageUploadQueue = new Queue<ImageUploadJobData>(
      'image-upload',
      defaultQueueOptions
    );

    this.initialized = true;
    strapi.log.info('✅ Queue service initialized');
  }

  /**
   * Enqueue supplier sync job
   */
  public async enqueueSupplierSync(
    supplierId: string,
    supplierCode: string,
    supplierNumericId: number,
    manual: boolean = true
  ): Promise<Job<SupplierSyncJobData>> {
    this.ensureInitialized();

    const jobId = generateJobId('supplier-sync', supplierCode);
    const jobData: SupplierSyncJobData = {
      supplierId,
      supplierCode,
      supplierNumericId,
      manual
    };

    const job = await this.supplierSyncQueue.add(
      jobId,
      jobData,
      supplierSyncJobOptions as JobsOptions
    );

    strapi.log.info(`📋 Enqueued supplier sync job: ${job.id} (${supplierCode})`);
    return job;
  }

  /**
   * Get job by ID
   */
  public async getJob(
    queueName: 'supplier-sync' | 'product-family' | 'image-upload',
    jobId: string
  ): Promise<Job | undefined> {
    this.ensureInitialized();
    const queue = this.getQueue(queueName);
    return await queue.getJob(jobId);
  }

  /**
   * Get queue statistics
   */
  public async getQueueStats(queueName: 'supplier-sync' | 'product-family' | 'image-upload') {
    this.ensureInitialized();
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);

    return {
      queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  }

  /**
   * Get detailed image upload statistics including deduplication
   */
  public async getImageUploadDetailedStats() {
    this.ensureInitialized();
    const queue = this.getQueue('image-upload');

    // Get basic counts
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);

    // Sample completed jobs to calculate deduplication rate
    // We'll check up to 1000 most recent completed jobs
    let actualUploads = 0;
    let deduplicated = 0;
    let sampledJobs = 0;

    try {
      const completedJobs = await queue.getJobs(['completed'], 0, 999, false);
      sampledJobs = completedJobs.length;

      for (const job of completedJobs) {
        if (job.returnvalue) {
          if (job.returnvalue.wasDedup === true) {
            deduplicated++;
          } else if (job.returnvalue.success === true) {
            actualUploads++;
          }
        }
      }
    } catch (error) {
      strapi.log.error('Error sampling completed jobs for dedup stats:', error);
    }

    // Calculate estimated deduplication rate
    const sampledTotal = actualUploads + deduplicated;
    const dedupRate = sampledTotal > 0 ? (deduplicated / sampledTotal) * 100 : 0;

    return {
      queueName: 'image-upload',
      waiting,
      active,
      completed, // Total completed (includes both uploads and dedups)
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
      // Detailed stats based on sampled jobs
      sampledJobs,
      actualUploads, // Jobs that actually uploaded
      deduplicated, // Jobs that were deduplicated (skipped)
      dedupRate: Math.round(dedupRate * 10) / 10, // Round to 1 decimal
      // Estimated totals (extrapolated if sample size < completed count)
      estimatedActualUploads: sampledTotal > 0 ? Math.round((actualUploads / sampledTotal) * completed) : 0,
      estimatedDeduplicated: sampledTotal > 0 ? Math.round((deduplicated / sampledTotal) * completed) : 0
    };
  }

  /**
   * Get all queue statistics
   */
  public async getAllStats() {
    this.ensureInitialized();
    const [supplierSync, productFamily, imageUploadBasic] = await Promise.all([
      this.getQueueStats('supplier-sync'),
      this.getQueueStats('product-family'),
      this.getQueueStats('image-upload')
    ]);

    // Get detailed image upload stats with deduplication
    const imageUpload = await this.getImageUploadDetailedStats();

    return {
      supplierSync,
      productFamily,
      imageUpload
    };
  }

  /**
   * Clean old completed jobs from a queue
   * @param queueName - Queue to clean
   * @param olderThanMs - Clean jobs older than this (in milliseconds). Default: 24 hours
   * @param limit - Maximum number of jobs to clean per call. Default: 1000
   */
  public async cleanCompletedJobs(
    queueName: 'supplier-sync' | 'product-family' | 'image-upload',
    olderThanMs: number = 24 * 60 * 60 * 1000, // 24 hours default
    limit: number = 1000
  ): Promise<{ deletedCount: number }> {
    this.ensureInitialized();
    const queue = this.getQueue(queueName);

    try {
      // BullMQ's clean method removes jobs older than grace period
      // Returns array of deleted job IDs
      const deletedJobs = await queue.clean(olderThanMs, limit, 'completed');
      const deletedCount = deletedJobs.length;

      strapi.log.info(
        `🧹 Cleaned ${deletedCount} completed jobs from ${queueName} queue (older than ${olderThanMs}ms)`
      );

      return { deletedCount };
    } catch (error) {
      strapi.log.error(`Error cleaning ${queueName} queue:`, error);
      throw error;
    }
  }

  /**
   * Clean old failed jobs from a queue
   * @param queueName - Queue to clean
   * @param olderThanMs - Clean jobs older than this (in milliseconds). Default: 7 days
   * @param limit - Maximum number of jobs to clean per call. Default: 1000
   */
  public async cleanFailedJobs(
    queueName: 'supplier-sync' | 'product-family' | 'image-upload',
    olderThanMs: number = 7 * 24 * 60 * 60 * 1000, // 7 days default
    limit: number = 1000
  ): Promise<{ deletedCount: number }> {
    this.ensureInitialized();
    const queue = this.getQueue(queueName);

    try {
      const deletedJobs = await queue.clean(olderThanMs, limit, 'failed');
      const deletedCount = deletedJobs.length;

      strapi.log.info(
        `🧹 Cleaned ${deletedCount} failed jobs from ${queueName} queue (older than ${olderThanMs}ms)`
      );

      return { deletedCount };
    } catch (error) {
      strapi.log.error(`Error cleaning failed jobs from ${queueName} queue:`, error);
      throw error;
    }
  }

  /**
   * Clean all old jobs from all queues
   * @param completedOlderThanMs - Clean completed jobs older than this. Default: 24 hours
   * @param failedOlderThanMs - Clean failed jobs older than this. Default: 7 days
   */
  public async cleanAllQueues(
    completedOlderThanMs: number = 24 * 60 * 60 * 1000,
    failedOlderThanMs: number = 7 * 24 * 60 * 60 * 1000
  ): Promise<{ totalDeleted: number; details: Record<string, { completed: number; failed: number }> }> {
    this.ensureInitialized();

    const queueNames: Array<'supplier-sync' | 'product-family' | 'image-upload'> = [
      'supplier-sync',
      'product-family',
      'image-upload'
    ];

    const results: Record<string, { completed: number; failed: number }> = {};
    let totalDeleted = 0;

    for (const queueName of queueNames) {
      const completedResult = await this.cleanCompletedJobs(queueName, completedOlderThanMs);
      const failedResult = await this.cleanFailedJobs(queueName, failedOlderThanMs);

      results[queueName] = {
        completed: completedResult.deletedCount,
        failed: failedResult.deletedCount
      };

      totalDeleted += completedResult.deletedCount + failedResult.deletedCount;
    }

    strapi.log.info(`🧹 Total cleanup: ${totalDeleted} jobs deleted across all queues`);

    return { totalDeleted, details: results };
  }

  /**
   * Close all queues
   */
  public async close(): Promise<void> {
    if (!this.initialized) {
      strapi.log.warn('Queue service not initialized, nothing to close');
      return;
    }

    strapi.log.info('🛑 Closing all queues...');

    const queues = [
      this.supplierSyncQueue,
      this.productFamilyQueue,
      this.imageUploadQueue
    ];

    await Promise.all(
      queues.filter(q => q !== null).map(q => q!.close())
    );

    this.supplierSyncQueue = null;
    this.productFamilyQueue = null;
    this.imageUploadQueue = null;
    this.initialized = false;

    strapi.log.info('✅ All queues closed');
  }

  /**
   * Get queue instance (internal helper)
   */
  private getQueue(queueName: 'supplier-sync' | 'product-family' | 'image-upload'): Queue {
    let queue: Queue | null = null;

    switch (queueName) {
      case 'supplier-sync':
        queue = this.supplierSyncQueue;
        break;
      case 'product-family':
        queue = this.productFamilyQueue;
        break;
      case 'image-upload':
        queue = this.imageUploadQueue;
        break;
    }

    if (!queue) {
      throw new Error(`Queue "${queueName}" not initialized`);
    }

    return queue;
  }
}

// Export singleton instance
export default new QueueService();
