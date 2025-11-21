/**
 * Product Family Worker
 * Processes product family jobs from the product-family queue
 *
 * Responsibilities:
 * 1. Transform product data
 * 2. Create/update Product entity
 * 3. Transform and create/update ProductVariant entities
 * 4. Enqueue image upload jobs for variants
 */

import { Worker, Job, Queue } from 'bullmq';
import {
  productFamilyWorkerOptions,
  imageUploadJobOptions,
  getRedisConnection
} from '../queue-config';

// Import modular services
import groupingService from '../../promidata/transformers/grouping';
import productTransformer from '../../promidata/transformers/product-transformer';
import variantTransformer from '../../promidata/transformers/variant-transformer';
import productSyncService from '../../promidata/sync/product-sync-service';
import variantSyncService from '../../promidata/sync/variant-sync-service';
import deduplicationService from '../../promidata/media/deduplication';
import queueService from '../queue-service';
import type { ImageUploadJobData } from '../job-types';

/**
 * Product Family Job Data
 */
export interface ProductFamilyJobData {
  aNumber: string;
  variants: any[];
  supplierId: number;
  supplierCode: string;
  productHash: string;
}

/**
 * Create Product Family Worker
 */
export function createProductFamilyWorker(): Worker<ProductFamilyJobData> {
  const worker = new Worker<ProductFamilyJobData>(
    'product-family',
    async (job: Job<ProductFamilyJobData>) => {
      const { aNumber, variants, supplierId, supplierCode, productHash } = job.data;

      // Input validation
      if (!aNumber || typeof aNumber !== 'string') {
        throw new Error('Invalid job data: aNumber must be a non-empty string');
      }
      if (!Array.isArray(variants) || variants.length === 0) {
        throw new Error('Invalid job data: variants must be a non-empty array');
      }
      if (!supplierId || typeof supplierId !== 'number') {
        throw new Error('Invalid job data: supplierId must be a number');
      }
      if (!supplierCode || typeof supplierCode !== 'string') {
        throw new Error('Invalid job data: supplierCode must be a non-empty string');
      }

      strapi.log.info(`🔨 [Worker] Processing product family: ${aNumber}`);

      try {
        // Step 1: Group variants by color
        await job.updateProgress({ step: 'grouping_colors', percentage: 10 });
        const colorGroups = groupingService.groupByColor(variants);
        strapi.log.info(`  └─ ${colorGroups.size} colors, ${variants.length} variants total`);

        // Step 2: Transform and create/update Product
        await job.updateProgress({ step: 'creating_product', percentage: 30 });
        const productData = productTransformer.transform(aNumber, variants, supplierId, productHash);
        const productResult = await productSyncService.createOrUpdate(productData);

        const productId = Number(productResult.productId);
        strapi.log.info(`  └─ Product ${productResult.isNew ? 'created' : 'updated'}: ID ${productId}`);

        // Step 3: Transform and create/update ProductVariants
        await job.updateProgress({ step: 'creating_variants', percentage: 50 });
        const variantResults = [];
        const imageJobs = [];

        // Get image upload queue
        const imageUploadQueue = new Queue('image-upload', { connection: getRedisConnection() });

        let processed = 0;
        const totalVariants = variants.length;
        let isFirstVariant = true; // Track absolute first variant for Product image

        for (const [color, colorGroup] of colorGroups.entries()) {
          const colorVariants = colorGroup.variants;

          for (let i = 0; i < colorVariants.length; i++) {
            const variantRawData = colorVariants[i];
            const isPrimary = (i === 0); // First variant of each color is primary

            // Transform variant data
            const variantData = variantTransformer.transform(
              variantRawData,
              productId,
              productData.name,
              isPrimary
            );

            // Create/update variant
            const variantResult = await variantSyncService.createOrUpdate(variantData);
            variantResults.push(variantResult);

            // Enqueue image upload jobs for this variant
            // Use transformer to extract image URLs from Promidata structure
            const imageUrls = variantTransformer.extractImageUrls(variantRawData);

            // Primary image
            if (imageUrls.primaryImage) {
              const fileName = `variant-${variantResult.variantId}-primary.jpg`;

              // Check if image already exists (deduplication)
              const dedupCheck = await deduplicationService.checkByFilename(fileName);

              if (dedupCheck.exists && dedupCheck.mediaId) {
                // Image already exists, just link it to the variant
                await variantSyncService.updateImages(Number(variantResult.variantId), dedupCheck.mediaId);

                // If this is the first variant, also set Product's main_image
                if (isFirstVariant && dedupCheck.mediaId) {
                  await strapi.entityService.update('api::product.product', productId, {
                    data: { main_image: dedupCheck.mediaId }
                  });
                  strapi.log.info(`  ↻ Set Product ${productId} main_image from deduplicated variant image`);
                }

                strapi.log.info(`  ↻ Deduplicated primary image for variant ${variantResult.variantId}`);
              } else {
                // Image doesn't exist, create upload job
                const imageJobData: ImageUploadJobData = {
                  imageUrl: imageUrls.primaryImage,
                  fileName: `variant-${variantResult.variantId}-primary`,
                  entityType: 'product-variant',
                  entityId: Number(variantResult.variantId),
                  fieldName: 'primary_image',
                  updateParentProduct: isFirstVariant, // Mark first variant to update Product
                  parentProductId: isFirstVariant ? productId : undefined
                };

                const imageJob = await imageUploadQueue.add(
                  `image-variant-${variantResult.variantId}-primary`,
                  imageJobData,
                  imageUploadJobOptions
                  // Note: Removed parent relationship to prevent BullMQ dependency errors
                  // Product-family jobs complete immediately, image jobs run independently
                );

                imageJobs.push(imageJob.id);
              }
            }

            // Gallery images
            const galleryMediaIds: number[] = [];
            for (let idx = 0; idx < imageUrls.galleryImages.length; idx++) {
              const imageUrl = imageUrls.galleryImages[idx];
              const fileName = `variant-${variantResult.variantId}-gallery-${idx}.jpg`;

              // Check if image already exists (deduplication)
              const dedupCheck = await deduplicationService.checkByFilename(fileName);

              if (dedupCheck.exists && dedupCheck.mediaId) {
                // Image already exists, collect media ID for batch update
                galleryMediaIds.push(dedupCheck.mediaId);
                strapi.log.info(`  ↻ Deduplicated gallery image ${idx} for variant ${variantResult.variantId}`);
              } else {
                // Image doesn't exist, create upload job
                const imageJobData: ImageUploadJobData = {
                  imageUrl,
                  fileName: `variant-${variantResult.variantId}-gallery-${idx}`,
                  entityType: 'product-variant',
                  entityId: Number(variantResult.variantId),
                  fieldName: 'gallery_images',
                  index: idx
                };

                const imageJob = await imageUploadQueue.add(
                  `image-variant-${variantResult.variantId}-gallery-${idx}`,
                  imageJobData,
                  imageUploadJobOptions
                  // Note: Removed parent relationship to prevent BullMQ dependency errors
                  // Product-family jobs complete immediately, image jobs run independently
                );

                imageJobs.push(imageJob.id);
              }
            }

            // Link deduplicated gallery images to variant
            if (galleryMediaIds.length > 0) {
              await variantSyncService.updateImages(Number(variantResult.variantId), undefined, galleryMediaIds);
            }

            // After processing first variant, subsequent ones won't update Product
            if (isFirstVariant) {
              isFirstVariant = false;
            }

            processed++;
            const percentage = 50 + Math.floor((processed / totalVariants) * 40);
            await job.updateProgress({ step: 'creating_variants', percentage, processed, total: totalVariants });
          }
        }

        await job.updateProgress({ step: 'complete', percentage: 100 });

        strapi.log.info(`  ✓ ${aNumber}: Product + ${variantResults.length} variants, ${imageJobs.length} images enqueued`);

        // Enqueue Meilisearch sync for each variant with 5-minute delay
        // This allows time for image uploads to complete before indexing
        for (const variantResult of variantResults) {
          if (variantResult.documentId) {
            await queueService.enqueueMeilisearchSync(
              'update',
              'product-variant',
              Number(variantResult.variantId),
              variantResult.documentId,
              5, // Low priority since it's delayed anyway
              300000 // 5 minutes delay (300,000 ms)
            );
          } else {
            strapi.log.warn(`  ⚠️  Variant ${variantResult.variantId} missing documentId, skipping Meilisearch sync`);
          }
        }

        const syncedCount = variantResults.filter(v => v.documentId).length;
        strapi.log.info(`  └─ ${syncedCount} Meilisearch sync jobs enqueued (5-min delay)`);

        return {
          aNumber,
          productId,
          variantsCreated: variantResults.length,
          imagesEnqueued: imageJobs.length,
          imageJobIds: imageJobs
        };

      } catch (error) {
        strapi.log.error(`❌ Failed to process product family ${aNumber}:`, error);
        throw error;
      }
    },
    productFamilyWorkerOptions
  );

  // Event handlers
  worker.on('completed', (job) => {
    strapi.log.info(`✅ [Worker] Product family job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    strapi.log.error(`❌ [Worker] Product family job ${job?.id} failed:`, error);
  });

  worker.on('error', (error) => {
    strapi.log.error(`❌ [Worker] Product family worker error:`, error);
  });

  return worker;
}
