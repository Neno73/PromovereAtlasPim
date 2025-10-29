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
 */

import { Worker, Job } from 'bullmq';
import { imageUploadWorkerOptions } from '../queue-config';

// Import media services
import imageUploadService from '../../promidata/media/image-upload-service';
import variantSyncService from '../../promidata/sync/variant-sync-service';

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
}

/**
 * Create Image Upload Worker
 */
export function createImageUploadWorker(): Worker<ImageUploadJobData> {
  const worker = new Worker<ImageUploadJobData>(
    'image-upload',
    async (job: Job<ImageUploadJobData>) => {
      const { imageUrl, fileName, entityType, entityId, fieldName, index } = job.data;

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
          } else {
            // Update gallery images
            // For now, we'll update one at a time
            // TODO: Batch gallery image updates
            await variantSyncService.updateImages(entityId, undefined, [result.mediaId]);
          }
        }
        // TODO: Handle product images when needed

        await job.updateProgress({ step: 'complete', percentage: 100 });

        return {
          fileName,
          mediaId: result.mediaId,
          url: result.url,
          wasDedup: result.wasDedup,
          entityType,
          entityId
        };

      } catch (error) {
        strapi.log.error(`❌ Failed to upload image ${fileName}:`, error);
        throw error;
      }
    },
    imageUploadWorkerOptions
  );

  // Event handlers
  worker.on('completed', (job) => {
    strapi.log.info(`✅ [Worker] Image upload job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    strapi.log.error(`❌ [Worker] Image upload job ${job?.id} failed:`, error);
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
