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
 * NOTE: Environment variables are loaded by Strapi at startup.
 * Since we use inline processors (not sandboxed), workers share the same
 * process.env as Strapi - no need for separate dotenv.config() here.
 *
 * ---
 *
 * @module GeminiSyncWorker
 */

import type { Core } from '@strapi/strapi';

// Declare global strapi instance (available at runtime via Strapi)
declare const strapi: Core.Strapi;

import { Worker, Job } from 'bullmq';
import { geminiSyncWorkerOptions, QUEUE_NAMES } from '../queue-config';
import type {
  GeminiSyncJobData,
  GeminiSyncJobResult,
} from '../job-types';
import syncSessionTracker from '../../sync-session-tracker';

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
    QUEUE_NAMES.GEMINI_SYNC,
    async (job: Job<GeminiSyncJobData>) => {
      // DEBUG: Write to file to bypass all logging issues
      const fs = require('fs');
      const apiKeyExists = typeof process.env.GEMINI_API_KEY !== 'undefined' && process.env.GEMINI_API_KEY !== '';
      const apiKeyLen = process.env.GEMINI_API_KEY?.length || 0;
      const debugMsg = `[${new Date().toISOString()}] Job ${job.id} | GEMINI_API_KEY: ${apiKeyExists ? `yes (${apiKeyLen} chars)` : 'NO'} | strapi: ${typeof strapi}\n`;
      fs.appendFileSync('/tmp/gemini-worker-debug.log', debugMsg);

      const { operation, documentId, sessionId } = job.data;

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

            // Update session counter for skipped/failed deletes
            if (sessionId) {
              await syncSessionTracker.incrementCounter(sessionId, 'gemini_skipped');
            }
          } else {
            // Update session counter for successful delete
            if (sessionId) {
              await syncSessionTracker.incrementCounter(sessionId, 'gemini_synced');
            }
          }

          return {
            success: true, // Don't fail job if file not found
            operation,
            documentId,
            sessionId,
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

              // Update session counter for skipped
              if (sessionId) {
                await syncSessionTracker.incrementCounter(sessionId, 'gemini_skipped');
              }

              return {
                success: true, // Mark as success to prevent retries
                operation,
                documentId,
                error: result.error,
                skipped: true,
                sessionId,
              };
            }

            // Other error - fail and retry
            throw new Error(result.error || 'Unknown error');
          }

          // Update session counter for successful sync
          if (sessionId) {
            await syncSessionTracker.incrementCounter(sessionId, 'gemini_synced');
          }

          return {
            success: true,
            operation,
            documentId,
            sessionId,
          };
        }
      } catch (error) {
        strapi.log.error(`❌ Failed to sync product ${documentId} to Gemini:`, error);

        // Update session failure counter
        if (sessionId) {
          await syncSessionTracker.incrementCounter(sessionId, 'gemini_failed');
          await syncSessionTracker.addError(sessionId, 'gemini', error.message || 'Unknown error', {
            documentId,
            operation
          });
        }

        // Return error result (will trigger retry based on job config)
        return {
          success: false,
          operation,
          documentId,
          error: error.message || 'Unknown error',
          sessionId,
        };
      }
    },
    geminiSyncWorkerOptions
  );

  // Worker connection event handlers - CRITICAL for debugging
  worker.on('ready', () => {
    strapi.log.info('🟢 [Gemini Worker] Connected to Redis and ready to process jobs');
  });

  worker.on('active', (job) => {
    strapi.log.info(`📥 [Gemini] Job ${job.id} now active - processing ${job.data.operation} for ${job.data.documentId}`);
  });

  // Worker event handlers
  worker.on('completed', async (job, result) => {
    if (result.skipped) {
      strapi.log.info(
        `⏭️  [Gemini] Skipped ${result.operation} for ${result.documentId} (not in Meilisearch)`
      );
    } else if (result.success) {
      strapi.log.info(
        `✅ [Gemini] Completed ${result.operation} for ${result.documentId}`
      );
    }

    // Check if gemini stage is complete (this is the FINAL stage)
    const sessionId = result.sessionId || job.data.sessionId;
    if (sessionId) {
      try {
        const stageStatus = await syncSessionTracker.isStageComplete(sessionId, 'gemini');
        if (stageStatus.complete) {
          await syncSessionTracker.completeStage(sessionId, 'gemini', {
            gemini_total: stageStatus.total,
            gemini_synced: stageStatus.processed - (stageStatus.failed || 0),
            gemini_failed: stageStatus.failed
          });
          strapi.log.info(`📋 Session ${sessionId}: Gemini stage complete (${stageStatus.processed}/${stageStatus.total})`);

          // Complete the entire sync session (gemini is the final stage)
          await syncSessionTracker.completeSession(sessionId);
          strapi.log.info(`🏁 Session ${sessionId}: SYNC COMPLETE - All stages finished`);
        }
      } catch (sessionError) {
        strapi.log.error(`Failed to check session ${sessionId}:`, sessionError);
      }
    }
  });

  worker.on('failed', async (job, error) => {
    if (job) {
      strapi.log.error(
        `❌ [Gemini] Failed ${job.data.operation} for ${job.data.documentId} after ${job.attemptsMade} attempts:`,
        error
      );

      // Check if gemini stage should complete (even with failures)
      if (job.data.sessionId) {
        try {
          const stageStatus = await syncSessionTracker.isStageComplete(job.data.sessionId, 'gemini');
          if (stageStatus.complete) {
            await syncSessionTracker.completeStage(job.data.sessionId, 'gemini', {
              gemini_total: stageStatus.total,
              gemini_synced: stageStatus.processed - (stageStatus.failed || 0),
              gemini_failed: stageStatus.failed
            });
            strapi.log.info(`📋 Session ${job.data.sessionId}: Gemini stage complete with failures (${stageStatus.failed} failed)`);

            // Complete the entire sync session (gemini is the final stage)
            await syncSessionTracker.completeSession(job.data.sessionId);
            strapi.log.info(`🏁 Session ${job.data.sessionId}: SYNC COMPLETE - All stages finished (with some failures)`);
          }
        } catch (sessionError) {
          strapi.log.error(`Failed to check session:`, sessionError);
        }
      }
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

