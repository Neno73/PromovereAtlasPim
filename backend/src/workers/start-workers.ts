/**
 * Standalone Worker Process Entry Point
 *
 * This file starts all BullMQ workers as a separate process.
 * Used for Coolify deployment where workers run independently from Strapi.
 *
 * Usage: node dist/workers/start-workers.js
 */

import { Worker } from 'bullmq';
import { createSupplierSyncWorker } from '../services/queue/workers/supplier-sync-worker';
import { createProductFamilyWorker } from '../services/queue/workers/product-family-worker';
import { createImageUploadWorker } from '../services/queue/workers/image-upload-worker';

/**
 * Worker Manager for Standalone Process
 */
class StandaloneWorkerManager {
  private workers: Worker[] = [];
  private isShuttingDown: boolean = false;

  /**
   * Initialize and start all workers
   */
  public async start(): Promise<void> {
    console.log('🚀 Starting BullMQ workers (standalone mode)...');

    try {
      // Create workers
      const supplierSyncWorker = createSupplierSyncWorker();
      const productFamilyWorker = createProductFamilyWorker();
      const imageUploadWorker = createImageUploadWorker();

      // Register workers
      this.workers = [
        supplierSyncWorker,
        productFamilyWorker,
        imageUploadWorker
      ];

      console.log(`✅ Started ${this.workers.length} workers:`);
      console.log('   - supplier-sync (concurrency: 1)');
      console.log('   - product-family (concurrency: 3)');
      console.log('   - image-upload (concurrency: 10)');
      console.log('');
      console.log('Workers are now listening for jobs...');
      console.log('Press Ctrl+C to stop.');

    } catch (error) {
      console.error('❌ Failed to start workers:', error);
      throw error;
    }
  }

  /**
   * Stop all workers gracefully
   */
  public async stop(): Promise<void> {
    if (this.isShuttingDown) {
      console.warn('⚠️  Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    console.log('');
    console.log('🛑 Shutting down workers gracefully...');

    try {
      // Close all workers
      await Promise.all(
        this.workers.map(async (worker) => {
          console.log(`   Closing worker: ${worker.name}`);
          await worker.close();
        })
      );

      this.workers = [];
      console.log('✅ All workers stopped gracefully');

    } catch (error) {
      console.error('❌ Error stopping workers:', error);
      throw error;
    }
  }

  /**
   * Get worker health status
   */
  public getHealth() {
    return {
      workers: this.workers.map(w => ({
        name: w.name,
        isRunning: w.isRunning(),
        isPaused: w.isPaused()
      }))
    };
  }
}

/**
 * Main entry point
 */
async function main() {
  const manager = new StandaloneWorkerManager();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🔔 Received ${signal}, shutting down...`);
    try {
      await manager.stop();
      console.log('👋 Goodbye!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });

  // Start workers
  try {
    await manager.start();

    // Log health status every 5 minutes
    setInterval(() => {
      const health = manager.getHealth();
      console.log('\n📊 Worker Health Check:');
      health.workers.forEach(w => {
        const status = w.isRunning ? '✅ Running' : '❌ Stopped';
        const paused = w.isPaused ? ' (Paused)' : '';
        console.log(`   ${w.name}: ${status}${paused}`);
      });
    }, 5 * 60 * 1000); // Every 5 minutes

  } catch (error) {
    console.error('❌ Failed to start workers:', error);
    process.exit(1);
  }
}

// Start the worker process
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
