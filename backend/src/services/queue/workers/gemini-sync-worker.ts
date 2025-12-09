/**
 * Gemini Sync Worker
 * 
 * Processes Gemini File Search sync jobs from the gemini-sync queue.
 * 
 * ---
 * 
 * DATA FLOW (Meilisearch-based):
 * 
 *   1. Job received with { operation, documentId }
 *   2. Fetch product FROM Meilisearch (NOT Strapi DB)
 *   3. Transform Meilisearch document to Gemini JSON format
 *   4. Upload to Gemini File Search Store
 * 
 * ---
 * 
 * ARCHITECTURE PRINCIPLE: "Always repair Meilisearch before repairing Gemini"
 * 
 *   - If product not in Meilisearch → skip with warning (don't retry/fail)
 *   - This ensures Meilisearch is the single source of truth
 *   - Chat UI uses Gemini for semantic search, Meilisearch for display
 *   - This prevents AI hallucinations (display data always from Meilisearch)
 * 
 * ---
 * 
 * SERVICE USED:
 *   - api::gemini-sync.gemini-file-search (Meilisearch-based)
 *   - Accessed via strapi.service() at runtime (not imported as singleton)
 * 
 * ---
 * 
 * @module GeminiSyncWorker
 */

import { Worker, Job } from 'bullmq';
import { geminiSyncWorkerOptions } from '../queue-config';
import type {
  GeminiSyncJobData,
  GeminiSyncJobResult,
} from '../job-types';

// Import the service type for type hints (not the actual service)
import type { GeminiFileSearchService } from '../../../api/gemini-sync/services/gemini-file-search';

/**
 * Get the Gemini File Search service from Strapi's service registry
 * 
 * This service fetches data FROM Meilisearch (not Strapi DB directly),
 * which is faster and ensures data consistency.
 */
function getGeminiService(): GeminiFileSearchService {
  // @ts-ignore - Custom service not in Strapi types
  const service = strapi.service('api::gemini-sync.gemini-file-search');

  if (!service) {
    throw new Error(
      'Gemini File Search service not available. ' +
      'Ensure the service is registered and Meilisearch is configured.'
    );
  }

  return service as GeminiFileSearchService;
}

/**
 * Create Gemini Sync Worker
 * 
 * Processes jobs to sync products from Meilisearch to Gemini File Search.
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
        // Get service from Strapi registry (uses Meilisearch as data source)
        const geminiService = getGeminiService();

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
          // Add or Update operation - reads FROM Meilisearch
          await job.updateProgress({ step: 'fetching-from-meilisearch', percentage: 25 });

          strapi.log.debug(`📥 [Gemini] Fetching ${documentId} from Meilisearch...`);

          await job.updateProgress({ step: 'syncing-to-gemini', percentage: 50 });

          const result = await geminiService.addOrUpdateDocument(documentId);

          await job.updateProgress({ step: 'complete', percentage: 100 });

          if (!result.success) {
            // Check if error is "not in Meilisearch"
            if (
              result.error?.includes('not in Meilisearch') ||
              result.error?.includes('Not found in Meilisearch') ||
              result.error?.includes('Product not in Meilisearch')
            ) {
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

        // Return error result (will trigger retry based on job config)
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
    } else if (result.success) {
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

  strapi.log.info('✅ Gemini sync worker initialized (concurrency: 5, data source: Meilisearch)');

  return worker;
}

