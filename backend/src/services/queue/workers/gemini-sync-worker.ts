/**
 * Gemini Sync Worker
 * Processes Gemini File Search sync jobs from the gemini-sync queue
 *
 * Responsibilities:
 * 1. Read product FROM Meilisearch (NOT Strapi) - Meilisearch is source of truth
 * 2. Transform Meilisearch document to Gemini JSON format
 * 3. Upload to Gemini File Search
 * 4. Handle errors (skip if product not in Meilisearch)
 *
 * Architecture Principle: "Always repair Meilisearch before repairing Gemini"
 * - If product not in Meilisearch → skip with warning (don't retry/fail)
 * - This ensures data consistency and prevents duplicate transformation logic
 */

import { Worker, Job } from 'bullmq';
import { geminiSyncWorkerOptions } from '../queue-config';
import type {
  GeminiSyncJobData,
  GeminiSyncJobResult,
} from '../job-types';
import geminiService from '../../gemini/gemini-service';

/**
 * Create Gemini Sync Worker
 */
export function createGeminiSyncWorker(): Worker<
  GeminiSyncJobData,
  GeminiSyncJobResult
> {
  const worker = new Worker<GeminiSyncJobData, GeminiSyncJobResult>(
    'gemini-sync',
    async (job: Job<GeminiSyncJobData>) => {
      const { operation, documentId } = job.data;

      // Input validation
      if (!operation || !['add', 'update', 'delete'].includes(operation)) {
        throw new Error('Invalid job data: operation must be "add", "update", or "delete"');
      }
      if (!documentId || typeof documentId !== 'string') {
        throw new Error('Invalid job data: documentId must be a non-empty string');
      }

      strapi.log.info(`🤖 [Gemini] ${operation} product ${documentId}`);

      try {
        // Service is imported directly


        if (operation === 'delete') {
          // Delete operation
          await job.updateProgress({ step: 'deleting', percentage: 50 });

          const result = await geminiService.deleteDocument(documentId);

          await job.updateProgress({ step: 'complete', percentage: 100 });

          if (!result.success) {
            // Deletion failed (file not found) - log warning but don't fail job
            strapi.log.warn(`⚠️  [Gemini] Delete failed for ${documentId}: ${result.error}`);
          }

          return {
            success: true, // Don't fail job if file not found
            operation,
            documentId,
          };
        } else {
          // Add or Update operation - read FROM Meilisearch
          await job.updateProgress({ step: 'syncing', percentage: 50 });

          const result = await geminiService.addOrUpdateDocument(documentId);

          await job.updateProgress({ step: 'complete', percentage: 100 });

          if (!result.success) {
            // Check if error is "not in Meilisearch"
            if (result.error?.includes('not in Meilisearch') || result.error?.includes('Not found in Meilisearch')) {
              // Architecture principle: Skip if not in Meilisearch (don't fail job)
              strapi.log.warn(
                `⚠️  [Gemini] Skipped ${documentId}: ${result.error} ` +
                `(Fix Meilisearch first, then re-trigger Gemini sync)`
              );

              return {
                success: true, // Mark as success to prevent retries
                operation,
                documentId,
                error: result.error,
                skipped: true,
              };
            }

            // Other error - fail and retry
            throw new Error(result.error || 'Unknown error');
          }

          return {
            success: true,
            operation,
            documentId,
          };
        }
      } catch (error) {
        strapi.log.error(`❌ Failed to sync product ${documentId} to Gemini:`, error);

        // Return error result (will trigger retry)
        return {
          success: false,
          operation,
          documentId,
          error: error.message || 'Unknown error',
        };
      }
    },
    geminiSyncWorkerOptions
  );

  // Worker event handlers
  worker.on('completed', (job, result) => {
    if (result.skipped) {
      strapi.log.info(
        `⏭️  [Gemini] Skipped ${result.operation} for ${result.documentId} (not in Meilisearch)`
      );
    } else {
      strapi.log.info(
        `✅ [Gemini] Completed ${result.operation} for ${result.documentId}`
      );
    }
  });

  worker.on('failed', (job, error) => {
    if (job) {
      strapi.log.error(
        `❌ [Gemini] Failed ${job.data.operation} for ${job.data.documentId} after ${job.attemptsMade} attempts:`,
        error
      );
    } else {
      strapi.log.error('❌ [Gemini] Job failed with no job data:', error);
    }
  });

  worker.on('error', (error) => {
    strapi.log.error('❌ [Gemini Worker] Worker error:', error);
  });

  worker.on('stalled', (jobId) => {
    strapi.log.warn(`⚠️ [Gemini] Job ${jobId} stalled (processing too long)`);
  });

  strapi.log.info('✅ Gemini sync worker initialized (concurrency: 5)');

  return worker;
}
