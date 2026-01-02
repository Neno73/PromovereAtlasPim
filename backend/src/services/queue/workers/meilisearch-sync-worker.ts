/**
 * Meilisearch Sync Worker
 * Processes search index sync jobs from the meilisearch-sync queue
 *
 * Responsibilities:
 * 1. Fetch product/variant from Strapi (with relations)
 * 2. Transform to Meilisearch document format
 * 3. Send to Meilisearch (add/update/delete)
 * 4. Handle errors with retry
 */

import { Worker, Job } from 'bullmq';
import { meilisearchSyncWorkerOptions } from '../queue-config';
import type {
  MeilisearchSyncJobData,
  MeilisearchSyncJobResult,
} from '../job-types';

/**
 * Create Meilisearch Sync Worker
 */
export function createMeilisearchSyncWorker(): Worker<
  MeilisearchSyncJobData,
  MeilisearchSyncJobResult
> {
  const worker = new Worker<MeilisearchSyncJobData, MeilisearchSyncJobResult>(
    'meilisearch-sync',
    async (job: Job<MeilisearchSyncJobData>) => {
      const { operation, entityType, entityId, documentId } = job.data;

      // Input validation
      if (!operation || !['add', 'update', 'delete'].includes(operation)) {
        throw new Error('Invalid job data: operation must be "add", "update", or "delete"');
      }
      if (!entityType || !['product', 'product-variant'].includes(entityType)) {
        throw new Error('Invalid job data: entityType must be "product" or "product-variant"');
      }
      if (!documentId || typeof documentId !== 'string') {
        throw new Error('Invalid job data: documentId must be a non-empty string');
      }

      strapi.log.info(`🔍 [Meilisearch] ${operation} ${entityType} ${documentId}`);

      try {
        // Get Meilisearch service
        // @ts-ignore - Custom service not in Strapi types
        const meilisearchService = strapi.service('api::product.meilisearch');

        if (operation === 'delete') {
          // Delete operation - only needs documentId
          await job.updateProgress({ step: 'deleting', percentage: 50 });

          const task = await meilisearchService.deleteDocument(documentId);

          await job.updateProgress({ step: 'complete', percentage: 100 });

          return {
            success: true,
            operation,
            documentId,
            taskUid: task.taskUid,
          };
        } else {
          // Add or Update operation - fetch entity from Strapi
          await job.updateProgress({ step: 'fetching', percentage: 20 });

          let entity: any;
          const apiPath =
            entityType === 'product' ? 'api::product.product' : 'api::product-variant.product-variant';

          // Fetch entity with all necessary relations
          if (entityType === 'product') {
            entity = await strapi.db.query(apiPath).findOne({
              where: { documentId },
              populate: [
                'supplier',
                'categories',
                'variants',
                'main_image',
                'gallery_images',
                'price_tiers',
                'dimensions',
              ],
            });
          } else {
            // Product variant
            entity = await strapi.db.query(apiPath).findOne({
              where: { documentId },
              populate: [
                'product',
                'primary_image',
                'gallery_images',
              ],
            });
          }

          if (!entity) {
            throw new Error(`${entityType} with documentId ${documentId} not found`);
          }

          // Transform and index
          await job.updateProgress({ step: 'indexing', percentage: 60 });

          let task;
          if (entityType === 'product') {
            task = await meilisearchService.addOrUpdateDocument(entity);
          } else {
            // For variants, we need to re-index the parent product
            // because variants are aggregated into the product document
            const parentProduct = entity.product;
            if (parentProduct && parentProduct.documentId) {
              // Fetch full product with all variants
              const fullProduct = await strapi.db.query('api::product.product').findOne({
                where: { documentId: parentProduct.documentId },
                populate: [
                  'supplier',
                  'categories',
                  'variants',
                  'main_image',
                  'gallery_images',
                  'price_tiers',
                  'dimensions',
                ],
              });

              if (fullProduct) {
                task = await meilisearchService.addOrUpdateDocument(fullProduct);
              } else {
                throw new Error(`Parent product ${parentProduct.documentId} not found`);
              }
            } else {
              throw new Error('Variant has no parent product');
            }
          }

          await job.updateProgress({ step: 'complete', percentage: 100 });

          // NOTE: Gemini sync is now manual only (via admin UI "Gemini" button)
          // Removed automatic trigger to allow manual control over when/which suppliers sync to Gemini
          // See: backend/src/admin/pages/supplier-sync.tsx → handleGeminiSync()

          return {
            success: true,
            operation,
            documentId,
            taskUid: task.taskUid,
          };
        }
      } catch (error) {
        strapi.log.error(`❌ Failed to sync ${entityType} ${documentId} to Meilisearch:`, error);

        // Return error result (will trigger retry)
        return {
          success: false,
          operation,
          documentId,
          error: error.message || 'Unknown error',
        };
      }
    },
    meilisearchSyncWorkerOptions
  );

  // Worker event handlers
  worker.on('completed', (job, result) => {
    strapi.log.info(
      `✅ [Meilisearch] Completed ${result.operation} for ${result.documentId} (task: ${result.taskUid})`
    );
  });

  worker.on('failed', (job, error) => {
    if (job) {
      strapi.log.error(
        `❌ [Meilisearch] Failed ${job.data.operation} for ${job.data.documentId} after ${job.attemptsMade} attempts:`,
        error
      );
    } else {
      strapi.log.error('❌ [Meilisearch] Job failed with no job data:', error);
    }
  });

  worker.on('error', (error) => {
    strapi.log.error('❌ [Meilisearch Worker] Worker error:', error);
  });

  worker.on('stalled', (jobId) => {
    strapi.log.warn(`⚠️ [Meilisearch] Job ${jobId} stalled (processing too long)`);
  });

  strapi.log.info('✅ Meilisearch sync worker initialized (concurrency: 5)');

  return worker;
}
