/**
 * Supplier Sync Worker
 * Processes supplier sync jobs from the supplier-sync queue
 *
 * Responsibilities:
 * 1. Parse Import.txt for supplier
 * 2. Fetch and group variant data
 * 3. Perform batch hash check
 * 4. Enqueue product family jobs for changed products
 * 5. Update supplier sync status
 */

import { Worker, Job, Queue } from 'bullmq';
import {
  supplierSyncWorkerOptions,
  productFamilyJobOptions,
  redisConnection
} from '../queue-config';

// Import modular services
import importParser from '../../promidata/parsers/import-parser';
import productParser from '../../promidata/parsers/product-parser';
import groupingService from '../../promidata/transformers/grouping';
import productSyncService from '../../promidata/sync/product-sync-service';

/**
 * Supplier Sync Job Data
 */
export interface SupplierSyncJobData {
  supplierId: string;      // Supplier documentId
  supplierCode: string;    // For logging
  supplierNumericId: number; // Numeric ID for database queries
  manual: boolean;         // Manual vs scheduled sync
}

/**
 * Product Family to be enqueued
 */
interface ProductFamilyJobData {
  aNumber: string;
  variants: any[];
  supplierId: number;
  supplierCode: string;
  productHash: string;
}

/**
 * Create Supplier Sync Worker
 */
export function createSupplierSyncWorker(): Worker<SupplierSyncJobData> {
  const worker = new Worker<SupplierSyncJobData>(
    'supplier-sync',
    async (job: Job<SupplierSyncJobData>) => {
      const { supplierId, supplierCode, supplierNumericId, manual } = job.data;
      const startTime = Date.now();

      strapi.log.info(`\n${'='.repeat(60)}`);
      strapi.log.info(`🔄 [Worker] Syncing supplier: ${supplierCode}`);
      strapi.log.info(`${'='.repeat(60)}\n`);

      try {
        // Step 1: Parse Import.txt
        await job.updateProgress({ step: 'parsing_import', percentage: 10 });
        strapi.log.info(`📋 Step 1: Parsing Import.txt for ${supplierCode}...`);

        const importEntries = await importParser.parseForSupplier(supplierCode);
        strapi.log.info(`✓ Found ${importEntries.length} variant entries`);

        if (importEntries.length === 0) {
          strapi.log.info(`⚠️  No products found for ${supplierCode}`);
          return {
            supplierCode,
            productsProcessed: 0,
            message: 'No products found'
          };
        }

        // Step 2: Fetch variant data
        await job.updateProgress({ step: 'fetching_variants', percentage: 30 });
        strapi.log.info(`\n📦 Step 2: Fetching variant data...`);

        const variantUrls = importEntries.map(e => e.url);
        const variantDataMap = await productParser.fetchAndParseBatch(variantUrls, 5);
        const allVariantData = Array.from(variantDataMap.values());

        strapi.log.info(`✓ Fetched ${allVariantData.length}/${variantUrls.length} variants`);

        // Step 3: Group by a_number
        await job.updateProgress({ step: 'grouping', percentage: 50 });
        strapi.log.info(`\n🔀 Step 3: Grouping variants by product family...`);

        const groupedByANumber = groupingService.groupByANumber(allVariantData);
        strapi.log.info(`✓ Identified ${groupedByANumber.size} product families`);

        // Step 4: Batch hash check
        await job.updateProgress({ step: 'hash_check', percentage: 60 });
        strapi.log.info(`\n🔍 Step 4: Performing batch hash check...`);

        const productFamilies = Array.from(groupedByANumber.entries()).map(([aNumber, variants]) => {
          const firstSku = variants[0].SKU || variants[0].sku;
          const matchingEntry = importEntries.find(e => e.sku === firstSku);
          return {
            aNumber,
            hash: matchingEntry?.hash || ''
          };
        });

        const filterResult = await productSyncService.filterProductsNeedingSync(
          productFamilies,
          supplierNumericId
        );

        strapi.log.info(`✓ Efficiency: ${filterResult.efficiency.toFixed(1)}% (${filterResult.skipped} unchanged)`);

        if (filterResult.needsSync.length === 0) {
          strapi.log.info(`✅ All products up-to-date for ${supplierCode}`);
          return {
            supplierCode,
            productsProcessed: 0,
            skipped: filterResult.skipped,
            efficiency: filterResult.efficiency
          };
        }

        // Step 5: Enqueue product family jobs
        await job.updateProgress({ step: 'enqueueing_families', percentage: 70 });
        strapi.log.info(`\n⚡ Step 5: Enqueueing ${filterResult.needsSync.length} product family jobs...`);

        // Get queue instance
        const productFamilyQueue = new Queue('product-family', { connection: redisConnection });

        const enqueuedJobs = [];
        for (const family of filterResult.needsSync) {
          const variants = groupedByANumber.get(family.aNumber);
          if (!variants || variants.length === 0) continue;

          const jobData: ProductFamilyJobData = {
            aNumber: family.aNumber,
            variants,
            supplierId: supplierNumericId,
            supplierCode,
            productHash: family.hash
          };

          const familyJob = await productFamilyQueue.add(
            `family-${supplierCode}-${family.aNumber}`,
            jobData,
            {
              ...productFamilyJobOptions,
              parent: {
                id: job.id!,
                queue: job.queueQualifiedName
              }
            }
          );

          enqueuedJobs.push(familyJob.id);
        }

        await job.updateProgress({ step: 'complete', percentage: 100 });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        strapi.log.info(`\n✅ Supplier sync completed for ${supplierCode}`);
        strapi.log.info(`   Product families enqueued: ${enqueuedJobs.length}`);
        strapi.log.info(`   Skipped (unchanged): ${filterResult.skipped}`);
        strapi.log.info(`   Duration: ${duration}s`);

        return {
          supplierCode,
          familiesEnqueued: enqueuedJobs.length,
          skipped: filterResult.skipped,
          efficiency: filterResult.efficiency,
          duration: `${duration}s`,
          jobIds: enqueuedJobs
        };

      } catch (error) {
        strapi.log.error(`❌ Supplier sync failed for ${supplierCode}:`, error);
        throw error;
      }
    },
    supplierSyncWorkerOptions
  );

  // Event handlers
  worker.on('completed', (job) => {
    strapi.log.info(`✅ [Worker] Supplier sync job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    strapi.log.error(`❌ [Worker] Supplier sync job ${job?.id} failed:`, error);
  });

  worker.on('error', (error) => {
    strapi.log.error(`❌ [Worker] Supplier sync worker error:`, error);
  });

  return worker;
}
