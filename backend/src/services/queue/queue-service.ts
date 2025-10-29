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

  /**
   * Initialize all queues
   */
  public async initialize(): Promise<void> {
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
    if (!this.supplierSyncQueue) {
      throw new Error('Queue service not initialized');
    }

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
   * Get queue statistics
   */
  public async getQueueStats(queueName: 'supplier-sync' | 'product-family' | 'image-upload') {
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
   * Close all queues
   */
  public async close(): Promise<void> {
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
