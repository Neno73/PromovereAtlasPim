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
  redisConnection
} from '../queue-config';

// Import modular services
import groupingService from '../../promidata/transformers/grouping';
import productTransformer from '../../promidata/transformers/product-transformer';
import variantTransformer from '../../promidata/transformers/variant-transformer';
import productSyncService from '../../promidata/sync/product-sync-service';
import variantSyncService from '../../promidata/sync/variant-sync-service';

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
 * Image Upload Job Data
 */
interface ImageUploadJobData {
  imageUrl: string;
  fileName: string;
  entityType: 'product' | 'product-variant';
  entityId: number;
  fieldName: 'primary_image' | 'gallery_images';
  index?: number;
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
        const imageUploadQueue = new Queue('image-upload', { connection: redisConnection });

        let processed = 0;
        const totalVariants = variants.length;

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
              const imageJobData: ImageUploadJobData = {
                imageUrl: imageUrls.primaryImage,
                fileName: `variant-${variantResult.variantId}-primary`,
                entityType: 'product-variant',
                entityId: Number(variantResult.variantId),
                fieldName: 'primary_image'
              };

              const imageJob = await imageUploadQueue.add(
                `image-variant-${variantResult.variantId}-primary`,
                imageJobData,
                {
                  ...imageUploadJobOptions,
                  parent: {
                    id: job.id!,
                    queue: job.queueQualifiedName
                  }
                }
              );

              imageJobs.push(imageJob.id);
            }

            // Gallery images
            for (let idx = 0; idx < imageUrls.galleryImages.length; idx++) {
              const imageUrl = imageUrls.galleryImages[idx];
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
                {
                  ...imageUploadJobOptions,
                  parent: {
                    id: job.id!,
                    queue: job.queueQualifiedName
                  }
                }
              );

              imageJobs.push(imageJob.id);
            }

            processed++;
            const percentage = 50 + Math.floor((processed / totalVariants) * 40);
            await job.updateProgress({ step: 'creating_variants', percentage, processed, total: totalVariants });
          }
        }

        await job.updateProgress({ step: 'complete', percentage: 100 });

        strapi.log.info(`  ✓ ${aNumber}: Product + ${variantResults.length} variants, ${imageJobs.length} images enqueued`);

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
