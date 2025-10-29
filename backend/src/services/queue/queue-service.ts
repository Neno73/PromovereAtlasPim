/**
 * Queue Service
 * Manages BullMQ queues for the Promidata sync system
 */

import { Queue, Job, JobsOptions } from 'bullmq';
import {
  QUEUE_NAMES,
  JOB_PREFIXES,
  SupplierSyncJobData,
  SupplierSyncJobResult,
  ProductFamilyJobData,
  ProductFamilyJobResult,
  ImageUploadJobData,
  ImageUploadJobResult,
} from './job-types';
import {
  defaultQueueOptions,
  supplierSyncJobOptions,
  productFamilyJobOptions,
  imageUploadJobOptions,
  generateJobId,
} from './queue-config';

/**
 * Queue Service Class
 * Singleton service for managing all BullMQ queues
 */
class QueueService {
  private static instance: QueueService;

  // Queue instances
  public supplierSyncQueue!: Queue<SupplierSyncJobData, SupplierSyncJobResult>;
  public productFamilyQueue!: Queue<ProductFamilyJobData, ProductFamilyJobResult>;
  public imageUploadQueue!: Queue<ImageUploadJobData, ImageUploadJobResult>;

  private initialized = false;

  /**
   * Private constructor (singleton pattern)
   */
  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Initialize all queues
   * Called once during Strapi bootstrap
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('⚠️  Queue service already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing BullMQ queue service...');

      // Initialize Supplier Sync Queue
      this.supplierSyncQueue = new Queue<SupplierSyncJobData, SupplierSyncJobResult>(
        QUEUE_NAMES.SUPPLIER_SYNC,
        defaultQueueOptions
      );

      // Initialize Product Family Queue
      this.productFamilyQueue = new Queue<ProductFamilyJobData, ProductFamilyJobResult>(
        QUEUE_NAMES.PRODUCT_FAMILY,
        defaultQueueOptions
      );

      // Initialize Image Upload Queue
      this.imageUploadQueue = new Queue<ImageUploadJobData, ImageUploadJobResult>(
        QUEUE_NAMES.IMAGE_UPLOAD,
        defaultQueueOptions
      );

      // Test Redis connection
      await this.testConnection();

      this.initialized = true;
      console.log('✅ Queue service initialized successfully');
      console.log(`   - Supplier Sync Queue: ${QUEUE_NAMES.SUPPLIER_SYNC}`);
      console.log(`   - Product Family Queue: ${QUEUE_NAMES.PRODUCT_FAMILY}`);
      console.log(`   - Image Upload Queue: ${QUEUE_NAMES.IMAGE_UPLOAD}`);
    } catch (error) {
      console.error('❌ Failed to initialize queue service:', error);
      throw error;
    }
  }

  /**
   * Test Redis connection
   */
  private async testConnection(): Promise<void> {
    try {
      // BullMQ doesn't expose client directly, so we test by checking queue
      const count = await this.supplierSyncQueue.count();
      console.log(`✓ Redis connection successful (${count} jobs in supplier queue)`);
    } catch (error) {
      console.error('✗ Redis connection failed:', error);
      throw new Error('Failed to connect to Redis. Check REDIS_URL in .env');
    }
  }

  /**
   * Add Supplier Sync Job
   */
  public async addSupplierSyncJob(
    data: SupplierSyncJobData,
    options?: Partial<JobsOptions>
  ): Promise<Job<SupplierSyncJobData, SupplierSyncJobResult>> {
    const jobId = generateJobId(JOB_PREFIXES.SUPPLIER_SYNC, data.supplierCode);

    const job = await this.supplierSyncQueue.add(
      'sync-supplier',
      data,
      {
        ...supplierSyncJobOptions,
        ...options,
        jobId,
      }
    );

    console.log(`📦 Queued supplier sync job: ${jobId} (Supplier: ${data.supplierCode})`);
    return job;
  }

  /**
   * Add Product Family Job
   */
  public async addProductFamilyJob(
    data: ProductFamilyJobData,
    options?: Partial<JobsOptions>
  ): Promise<Job<ProductFamilyJobData, ProductFamilyJobResult>> {
    const jobId = generateJobId(
      JOB_PREFIXES.PRODUCT_FAMILY,
      data.aNumber,
      data.supplierCode
    );

    const job = await this.productFamilyQueue.add(
      'process-family',
      data,
      {
        ...productFamilyJobOptions,
        ...options,
        jobId,
      }
    );

    return job;
  }

  /**
   * Add Image Upload Job
   */
  public async addImageUploadJob(
    data: ImageUploadJobData,
    options?: Partial<JobsOptions>
  ): Promise<Job<ImageUploadJobData, ImageUploadJobResult>> {
    const jobId = generateJobId(
      JOB_PREFIXES.IMAGE_UPLOAD,
      data.entityType,
      data.entityId,
      data.fileName.substring(0, 10)
    );

    const job = await this.imageUploadQueue.add(
      'upload-image',
      data,
      {
        ...imageUploadJobOptions,
        ...options,
        jobId,
      }
    );

    return job;
  }

  /**
   * Get Job by ID
   * Searches across all queues
   */
  public async getJob(jobId: string): Promise<Job<any, any> | null> {
    // Try each queue
    const supplierJob = await this.supplierSyncQueue.getJob(jobId);
    if (supplierJob) return supplierJob;

    const familyJob = await this.productFamilyQueue.getJob(jobId);
    if (familyJob) return familyJob;

    const imageJob = await this.imageUploadQueue.getJob(jobId);
    if (imageJob) return imageJob;

    return null;
  }

  /**
   * Get Job Status
   * Returns detailed status including progress
   */
  public async getJobStatus(jobId: string) {
    const job = await this.getJob(jobId);

    if (!job) {
      return {
        found: false,
        jobId,
      };
    }

    const state = await job.getState();
    const progress = job.progress as any;

    return {
      found: true,
      jobId: job.id,
      name: job.name,
      state,
      progress,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  /**
   * Cancel Job
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);

    if (!job) {
      return false;
    }

    try {
      await job.remove();
      console.log(`🗑️  Cancelled job: ${jobId}`);
      return true;
    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get Recent Jobs
   * Returns jobs from all queues, sorted by timestamp
   */
  public async getRecentJobs(limit: number = 20) {
    const [supplierJobs, familyJobs, imageJobs] = await Promise.all([
      this.supplierSyncQueue.getJobs(['completed', 'failed', 'active', 'waiting'], 0, limit),
      this.productFamilyQueue.getJobs(['completed', 'failed', 'active', 'waiting'], 0, limit),
      this.imageUploadQueue.getJobs(['completed', 'failed', 'active', 'waiting'], 0, limit),
    ]);

    const allJobs = [...supplierJobs, ...familyJobs, ...imageJobs];

    // Sort by timestamp (newest first)
    allJobs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return allJobs.slice(0, limit);
  }

  /**
   * Get Queue Statistics
   */
  public async getQueueStats() {
    const [supplierCounts, familyCounts, imageCounts] = await Promise.all([
      this.supplierSyncQueue.getJobCounts(),
      this.productFamilyQueue.getJobCounts(),
      this.imageUploadQueue.getJobCounts(),
    ]);

    return {
      supplierSync: supplierCounts,
      productFamily: familyCounts,
      imageUpload: imageCounts,
    };
  }

  /**
   * Shutdown
   * Gracefully close all queue connections
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down queue service...');

    await Promise.all([
      this.supplierSyncQueue?.close(),
      this.productFamilyQueue?.close(),
      this.imageUploadQueue?.close(),
    ]);

    this.initialized = false;
    console.log('✅ Queue service shut down');
  }
}

// Export singleton instance
export default QueueService.getInstance();
