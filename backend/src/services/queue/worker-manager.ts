/**
 * Worker Manager
 * Manages the lifecycle of all BullMQ workers
 *
 * Responsibilities:
 * 1. Create and register all workers
 * 2. Start workers on application boot
 * 3. Stop workers gracefully on shutdown
 * 4. Provide worker health status
 */

import { Worker } from 'bullmq';
import { createSupplierSyncWorker } from './workers/supplier-sync-worker';
import { createProductFamilyWorker } from './workers/product-family-worker';
import { createImageUploadWorker } from './workers/image-upload-worker';
import { createMeilisearchSyncWorker } from './workers/meilisearch-sync-worker';

/**
 * Worker Manager Class
 */
class WorkerManager {
  private workers: Worker[] = [];
  private isRunning: boolean = false;

  /**
   * Initialize and start all workers
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      strapi.log.warn('⚠️  Workers already running');
      return;
    }

    strapi.log.info('🚀 Starting BullMQ workers...');

    try {
      // Create workers
      const supplierSyncWorker = createSupplierSyncWorker();
      const productFamilyWorker = createProductFamilyWorker();
      const imageUploadWorker = createImageUploadWorker();
      const meilisearchSyncWorker = createMeilisearchSyncWorker();

      // Register workers
      this.workers = [
        supplierSyncWorker,
        productFamilyWorker,
        imageUploadWorker,
        meilisearchSyncWorker
      ];

      this.isRunning = true;

      strapi.log.info(`✅ Started ${this.workers.length} workers:`);
      strapi.log.info('   - supplier-sync (concurrency: 1)');
      strapi.log.info('   - product-family (concurrency: 3)');
      strapi.log.info('   - image-upload (concurrency: 10)');
      strapi.log.info('   - meilisearch-sync (concurrency: 5)');

    } catch (error) {
      strapi.log.error('❌ Failed to start workers:', error);
      throw error;
    }
  }

  /**
   * Stop all workers gracefully
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      strapi.log.warn('⚠️  Workers not running');
      return;
    }

    strapi.log.info('🛑 Stopping BullMQ workers...');

    try {
      // Close all workers
      await Promise.all(
        this.workers.map(worker => worker.close())
      );

      this.workers = [];
      this.isRunning = false;

      strapi.log.info('✅ All workers stopped');
    } catch (error) {
      strapi.log.error('❌ Error stopping workers:', error);
      throw error;
    }
  }

  /**
   * Get worker health status
   */
  public getHealth() {
    return {
      isRunning: this.isRunning,
      workerCount: this.workers.length,
      workers: this.workers.map(w => ({
        name: w.name,
        isRunning: w.isRunning(),
        isPaused: w.isPaused()
      }))
    };
  }

  /**
   * Restart all workers
   */
  public async restart(): Promise<void> {
    strapi.log.info('🔄 Restarting workers...');
    await this.stop();
    await this.start();
    strapi.log.info('✅ Workers restarted');
  }
}

// Export singleton instance
export default new WorkerManager();
