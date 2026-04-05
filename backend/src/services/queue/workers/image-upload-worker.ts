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
        // NOTE: we deliberately don't increment images_failed here. This catch
        // block runs on every retry attempt (BullMQ retries up to 5×), so
        // counting here inflates the failure count by the retry multiplier.
        // The worker.on('failed') handler below fires exactly once per job
        // after all retries are exhausted — that's where we count.
        throw error;
      }
    },
    imageUploadWorkerOptions
  );

  // The session's meilisearch stage is vestigial — indexing now happens
  // inline via strapi-plugin-meilisearch lifecycle hooks during the
  // promidata stage, so we skip the stage as soon as images finish.
  const PLUGIN_LIFECYCLE_REASON = 'handled by plugin lifecycle';

  /**
   * After any image job settles (success or final failure), check whether the
   * whole images stage is done and, if so, advance the session to the
   * vestigial meilisearch stage which we immediately skip. The stage
   * transition methods on the tracker are idempotent, so it's safe for this
   * to run many times in quick succession as the last batch of jobs finishes.
   *
   * We deliberately don't pass an `images_uploaded`/`images_failed` override
   * here — the tracker's incremental counters (bumped once per job in the
   * processor and the on('failed') handler below) are the source of truth.
   */
  const advanceStageIfComplete = async (sessionId: string) => {
    try {
      const stageStatus = await syncSessionTracker.isStageComplete(sessionId, 'images');
      if (!stageStatus.complete) return;

      await syncSessionTracker.completeStage(sessionId, 'images');
      await syncSessionTracker.skipStage(sessionId, 'meilisearch', PLUGIN_LIFECYCLE_REASON);
    } catch (sessionError) {
      strapi.log.error(`Failed to advance session ${sessionId}:`, sessionError);
    }
  };

  worker.on('completed', async (job) => {
    const { sessionId } = job.returnvalue || {};
    strapi.log.info(`✅ [Worker] Image upload job ${job.id} completed`);
    if (sessionId) await advanceStageIfComplete(sessionId);
  });

  // Fires once per job after BullMQ exhausts all retries. This is the correct
  // place to increment images_failed and record the error, NOT the processor's
  // catch block (which fires on every retry attempt).
  worker.on('failed', async (job, error) => {
    strapi.log.error(`❌ [Worker] Image upload job ${job?.id} failed after ${job?.attemptsMade} attempts:`, error);

    const sessionId = job?.data?.sessionId;
    if (!sessionId) return;

    try {
      await syncSessionTracker.incrementCounter(sessionId, 'images_failed');
      await syncSessionTracker.addError(sessionId, 'images', error?.message || 'Unknown error', {
        fileName: job?.data?.fileName,
        imageUrl: job?.data?.imageUrl,
        entityType: job?.data?.entityType,
        entityId: job?.data?.entityId,
        attempts: job?.attemptsMade
      });
    } catch (sessionError) {
      strapi.log.error(`Failed to record image failure for session ${sessionId}:`, sessionError);
    }

    await advanceStageIfComplete(sessionId);
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
