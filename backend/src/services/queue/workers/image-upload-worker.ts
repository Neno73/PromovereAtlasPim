/**
 * Image Upload Worker
 * Processes image upload jobs from the image-upload queue
 *
 * Responsibilities:
 * 1. Check for existing image (deduplication)
 * 2. Download image from Promidata
 * 3. Upload to Cloudflare R2
 * 4. Create Strapi media record
 * 5. Update entity relation (product or variant)
 * 6. Track progress via sync session
 */

import { Worker, Job } from 'bullmq';
import { imageUploadWorkerOptions, QUEUE_NAMES } from '../queue-config';

// Import media services
import imageUploadService from '../../promidata/media/image-upload-service';
import variantSyncService from '../../promidata/sync/variant-sync-service';
import productSyncService from '../../promidata/sync/product-sync-service';
import syncSessionTracker from '../../sync-session-tracker';

/**
 * Image Upload Job Data
 */
export interface ImageUploadJobData {
  imageUrl: string;          // Source URL from Promidata
  fileName: string;          // Target filename
  entityType: 'product' | 'product-variant';
  entityId: number;          // Product or ProductVariant ID
  fieldName: 'primary_image' | 'gallery_images';
  index?: number;            // Gallery image index (for ordering)
  updateParentProduct?: boolean; // If true, also set this image as parent Product's main_image
  parentProductId?: number;  // Parent Product ID (when updateParentProduct is true)
  sessionId?: string;        // Sync session ID for tracking across pipeline
}

/**
 * Create Image Upload Worker
 */
export function createImageUploadWorker(): Worker<ImageUploadJobData> {
  const worker = new Worker<ImageUploadJobData>(
    QUEUE_NAMES.IMAGE_UPLOAD,
    async (job: Job<ImageUploadJobData>) => {
      const { imageUrl, fileName, entityType, entityId, fieldName, index, updateParentProduct, parentProductId, sessionId } = job.data;

      // Input validation
      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('Invalid job data: imageUrl must be a non-empty string');
      }
      if (!fileName || typeof fileName !== 'string') {
        throw new Error('Invalid job data: fileName must be a non-empty string');
      }
      if (!entityType || !['product', 'product-variant'].includes(entityType)) {
        throw new Error('Invalid job data: entityType must be "product" or "product-variant"');
      }
      if (!entityId || typeof entityId !== 'number') {
        throw new Error('Invalid job data: entityId must be a number');
      }
      if (!fieldName || !['primary_image', 'gallery_images'].includes(fieldName)) {
        throw new Error('Invalid job data: fieldName must be "primary_image" or "gallery_images"');
      }

      strapi.log.info(`📸 [Worker] Uploading image: ${fileName}`);

      try {
        // Step 1: Upload image (includes deduplication check)
        await job.updateProgress({ step: 'uploading', percentage: 30 });

        const result = await imageUploadService.uploadFromUrl(imageUrl, fileName);

        if (!result.success) {
          throw new Error(result.error || 'Image upload failed');
        }

        strapi.log.info(`  └─ ${result.wasDedup ? 'Deduplicated' : 'Uploaded'}: ${result.url}`);

        // Step 2: Update entity relation
        await job.updateProgress({ step: 'updating_relation', percentage: 70 });

        if (entityType === 'product-variant' && result.mediaId) {
          if (fieldName === 'primary_image') {
            // Update primary image
            await variantSyncService.updateImages(entityId, result.mediaId);

            // If this is the first variant, also update parent Product's main_image
            if (updateParentProduct && parentProductId) {
              await productSyncService.update(parentProductId, {
                main_image: result.mediaId
              });
              strapi.log.info(`  └─ Updated Product ${parentProductId} main_image from first variant`);
            }
          } else {
            // Update gallery images
            // For now, we'll update one at a time
            // TODO: Batch gallery image updates
            await variantSyncService.updateImages(entityId, undefined, [result.mediaId]);
          }
        }
        // Product images handled via updateParentProduct flag from first variant

        await job.updateProgress({ step: 'complete', percentage: 100 });

        // Update session counters
        if (sessionId) {
          if (result.wasDedup) {
            await syncSessionTracker.incrementCounter(sessionId, 'images_deduplicated');
          } else {
            await syncSessionTracker.incrementCounter(sessionId, 'images_uploaded');
          }
        }

        return {
          fileName,
          mediaId: result.mediaId,
          url: result.url,
          wasDedup: result.wasDedup,
          entityType,
          entityId,
          sessionId
        };

      } catch (error) {
        strapi.log.error(`❌ Failed to upload image ${fileName}:`, error);
        // Update session failure counter
        if (sessionId) {
          await syncSessionTracker.incrementCounter(sessionId, 'images_failed');
          await syncSessionTracker.addError(sessionId, 'images', error?.message || 'Unknown error', {
            fileName,
            imageUrl,
            entityType,
            entityId
          });
        }
        throw error;
      }
    },
    imageUploadWorkerOptions
  );

  // Event handlers
  worker.on('completed', async (job) => {
    const { sessionId } = job.returnvalue || {};
    strapi.log.info(`✅ [Worker] Image upload job ${job.id} completed`);

    // Check if images stage is complete
    if (sessionId) {
      try {
        const stageStatus = await syncSessionTracker.isStageComplete(sessionId, 'images');
        if (stageStatus.complete) {
          await syncSessionTracker.completeStage(sessionId, 'images', {
            images_total: stageStatus.total,
            images_uploaded: stageStatus.processed - (stageStatus.failed || 0),
            images_failed: stageStatus.failed
          });
          strapi.log.info(`📋 Session ${sessionId}: Images stage complete (${stageStatus.processed}/${stageStatus.total})`);

          // Start meilisearch stage
          await syncSessionTracker.startStage(sessionId, 'meilisearch');
          strapi.log.info(`📋 Session ${sessionId}: Starting meilisearch stage`);
        }
      } catch (sessionError) {
        strapi.log.error(`Failed to check session ${sessionId}:`, sessionError);
      }
    }
  });

  worker.on('failed', async (job, error) => {
    strapi.log.error(`❌ [Worker] Image upload job ${job?.id} failed:`, error);

    // Session failure tracking is handled in the catch block above
    // Check if images stage should be marked as complete (even with failures)
    if (job?.data?.sessionId) {
      try {
        const stageStatus = await syncSessionTracker.isStageComplete(job.data.sessionId, 'images');
        if (stageStatus.complete) {
          await syncSessionTracker.completeStage(job.data.sessionId, 'images', {
            images_total: stageStatus.total,
            images_uploaded: stageStatus.processed - (stageStatus.failed || 0),
            images_failed: stageStatus.failed
          });
          strapi.log.info(`📋 Session ${job.data.sessionId}: Images stage complete with failures (${stageStatus.failed} failed)`);

          // Continue to meilisearch stage despite failures
          await syncSessionTracker.startStage(job.data.sessionId, 'meilisearch');
        }
      } catch (sessionError) {
        strapi.log.error(`Failed to check session:`, sessionError);
      }
    }
  });

  worker.on('error', (error) => {
    strapi.log.error(`❌ [Worker] Image upload worker error:`, error);
  });

  // Progress tracking
  worker.on('progress', (job, progress) => {
    if (progress && typeof progress === 'object' && 'step' in progress) {
      strapi.log.debug(`🔄 [Worker] Image ${job.id} progress: ${progress.step}`);
    }
  });

  return worker;
}
