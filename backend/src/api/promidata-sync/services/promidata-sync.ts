/**
 * Promidata Sync Service - Orchestration Layer
 *
 * This service acts as a thin orchestrator that delegates to:
 * - Queue-based processing (default, scalable, recommended)
 * - Direct processing (legacy, for testing/debugging)
 *
 * All business logic is in modular services under src/services/promidata/
 */

import { factories } from '@strapi/strapi';

// Import queue service
import queueService from '../../../services/queue/queue-service';

// Import modular services (for direct/legacy mode)
import promidataClient from '../../../services/promidata/api/promidata-client';
import importParser from '../../../services/promidata/parsers/import-parser';
import productParser from '../../../services/promidata/parsers/product-parser';
import categoryParser from '../../../services/promidata/parsers/category-parser';
import groupingService from '../../../services/promidata/transformers/grouping';
import productTransformer from '../../../services/promidata/transformers/product-transformer';
import variantTransformer from '../../../services/promidata/transformers/variant-transformer';
import productSyncService from '../../../services/promidata/sync/product-sync-service';
import variantSyncService from '../../../services/promidata/sync/variant-sync-service';

export default factories.createCoreService('api::promidata-sync.promidata-sync', ({ strapi }) => ({

  /**
   * Validate supplier documentId format
   */
  validateSupplierId(supplierId: string): void {
    if (!supplierId || typeof supplierId !== 'string' || supplierId.trim().length === 0) {
      throw new Error('Invalid supplier ID: must be a non-empty string');
    }
  },

  /**
   * Start sync for all suppliers or a specific supplier
   * Main entry point for manual synchronization
   *
   * @param supplierId - Optional supplier documentId to sync specific supplier
   * @param useQueue - Use queue-based processing (default: true)
   */
  async startSync(supplierId?: string, useQueue: boolean = true) {
    try {
      // Validate supplierId if provided
      if (supplierId) {
        this.validateSupplierId(supplierId);
      }

      strapi.log.info(`🚀 Starting ${useQueue ? 'queued' : 'direct'} sync${supplierId ? ` for supplier ${supplierId}` : ' for all suppliers'}`);

      let suppliers = [];

      if (supplierId) {
        // Sync specific supplier
        const supplier = await strapi.documents('api::supplier.supplier').findOne({
          documentId: supplierId
        });

        if (!supplier) {
          throw new Error(`Supplier ${supplierId} not found`);
        }

        if (!supplier.is_active) {
          throw new Error(`Supplier ${supplier.code} is not active`);
        }

        suppliers = [supplier];
      } else {
        // Sync all active suppliers
        const result = await strapi.documents('api::supplier.supplier').findMany({
          filters: { is_active: true },
          pagination: { page: 1, pageSize: 100 }
        });
        suppliers = result;
      }

      strapi.log.info(`📦 Found ${suppliers.length} active supplier(s) to sync`);

      // Choose processing mode
      if (useQueue) {
        return await this.startSyncQueued(suppliers);
      } else {
        return await this.startSyncDirect(suppliers);
      }

    } catch (error) {
      strapi.log.error('Sync failed:', error);
      throw error;
    }
  },

  /**
   * Start sync using queue-based processing (recommended)
   * Enqueues supplier sync jobs to be processed by workers
   */
  async startSyncQueued(suppliers: any[]) {
    try {
      const jobs = [];

      for (const supplier of suppliers) {
        try {
          // Ensure numeric ID for database operations
          const supplierNumericId = typeof supplier.id === 'number' ? supplier.id : Number(supplier.id);

          // Enqueue supplier sync job
          const job = await queueService.enqueueSupplierSync(
            supplier.documentId,
            supplier.code,
            supplierNumericId,
            true // manual sync
          );

          jobs.push({
            supplier: supplier.code,
            jobId: job.id,
            queueName: 'supplier-sync',
            status: 'enqueued'
          });

          strapi.log.info(`✅ Enqueued sync job for ${supplier.code}: ${job.id}`);

        } catch (error) {
          strapi.log.error(`Failed to enqueue sync for ${supplier.code}:`, error);
          jobs.push({
            supplier: supplier.code,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        mode: 'queued',
        suppliersEnqueued: suppliers.length,
        jobs,
        message: 'Sync jobs enqueued. Use getJobStatus() to track progress.'
      };

    } catch (error) {
      strapi.log.error('Failed to enqueue sync jobs:', error);
      throw error;
    }
  },

  /**
   * Start sync using direct processing (legacy mode)
   * Processes suppliers synchronously without queue
   */
  async startSyncDirect(suppliers: any[]) {
    try {
      const results = [];

      for (const supplier of suppliers) {
        try {
          const result = await this.syncSupplierDirect(supplier);
          results.push(result);
        } catch (error) {
          strapi.log.error(`Failed to sync supplier ${supplier.code}:`, error);
          results.push({
            supplier: supplier.code,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        mode: 'direct',
        suppliersProcessed: suppliers.length,
        results
      };

    } catch (error) {
      strapi.log.error('Direct sync failed:', error);
      throw error;
    }
  },

  /**
   * Sync a single supplier (direct mode - no queue)
   * Legacy method for backward compatibility and testing
   */
  async syncSupplierDirect(supplier: any) {
    const startTime = Date.now();
    strapi.log.info(`\n${'='.repeat(60)}`);
    strapi.log.info(`🔄 Syncing supplier: ${supplier.code} - ${supplier.name}`);
    strapi.log.info(`${'='.repeat(60)}\n`);

    try {
      // Step 1: Parse Import.txt for this supplier (gets variant URLs with hashes)
      strapi.log.info(`📋 Step 1: Parsing Import.txt for ${supplier.code}...`);
      const importEntries = await importParser.parseForSupplier(supplier.code);
      strapi.log.info(`✓ Found ${importEntries.length} variant entries`);

      if (importEntries.length === 0) {
        strapi.log.info(`⚠️  No products found for ${supplier.code}`);
        return { supplier: supplier.code, productsProcessed: 0 };
      }

      // Step 2: Fetch all variant data to extract a_numbers and group
      strapi.log.info(`\n📦 Step 2: Fetching variant data to identify product families...`);
      const variantUrls = importEntries.map(e => e.url);
      const variantDataMap = await productParser.fetchAndParseBatch(variantUrls, 5);

      const allVariantData = Array.from(variantDataMap.values());
      strapi.log.info(`✓ Fetched ${allVariantData.length}/${variantUrls.length} variants`);

      // Group by a_number to identify product families
      const groupedByANumber = groupingService.groupByANumber(allVariantData);
      strapi.log.info(`✓ Identified ${groupedByANumber.size} product families`);

      // Step 3: Batch hash check (Quick Win #2) - use first variant hash per family
      strapi.log.info(`\n🔍 Step 3: Performing batch hash check...`);
      const productFamilies = Array.from(groupedByANumber.entries()).map(([aNumber, variants]) => {
        // Use hash from first variant SKU
        const firstSku = variants[0].SKU || variants[0].sku;
        const matchingEntry = importEntries.find(e => e.sku === firstSku);
        return {
          aNumber,
          hash: matchingEntry?.hash || ''
        };
      });

      // Note: productSyncService expects numeric ID for database queries
      const supplierId = typeof supplier.id === 'number' ? supplier.id : Number(supplier.id);
      const filterResult = await productSyncService.filterProductsNeedingSync(
        productFamilies,
        supplierId
      );

      strapi.log.info(`✓ Efficiency: ${filterResult.efficiency.toFixed(1)}% (${filterResult.skipped} unchanged)`);

      if (filterResult.needsSync.length === 0) {
        strapi.log.info(`✅ All products up-to-date for ${supplier.code}`);
        return { supplier: supplier.code, productsProcessed: 0, skipped: filterResult.skipped };
      }

      // Step 4: Process product families needing sync
      strapi.log.info(`\n⚡ Step 4: Processing ${filterResult.needsSync.length} changed product families...`);

      let processedCount = 0;
      let errorCount = 0;

      for (const family of filterResult.needsSync) {
        try {
          const variants = groupedByANumber.get(family.aNumber);
          if (!variants || variants.length === 0) continue;

          await this.processProductFamily(family.aNumber, variants, supplier, family.hash);
          processedCount++;

        } catch (error) {
          strapi.log.error(`Failed to process product family ${family.aNumber}:`, error);
          errorCount++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      strapi.log.info(`\n✅ Sync completed for ${supplier.code}`);
      strapi.log.info(`   Products processed: ${processedCount}`);
      strapi.log.info(`   Errors: ${errorCount}`);
      strapi.log.info(`   Duration: ${duration}s`);

      return {
        supplier: supplier.code,
        productsProcessed: processedCount,
        errors: errorCount,
        skipped: filterResult.skipped,
        duration: `${duration}s`
      };

    } catch (error) {
      strapi.log.error(`Sync failed for ${supplier.code}:`, error);
      throw error;
    }
  },

  /**
   * Process a single product family (Product + Variants)
   * Implements Product → ProductVariant hierarchy
   */
  async processProductFamily(aNumber: string, variants: any[], supplier: any, productHash: string) {
    try {
      // Step 1: Group variants by color to identify primary variants
      const colorGroups = groupingService.groupByColor(variants);

      // Step 2: Transform and create/update Product (parent)
      // Ensure numeric supplier ID for database operations
      const supplierId = typeof supplier.id === 'number' ? supplier.id : Number(supplier.id);
      const productData = productTransformer.transform(aNumber, variants, supplierId, productHash);
      const productResult = await productSyncService.createOrUpdate(productData);

      const productId = Number(productResult.productId);

      // Step 3: Transform and create/update ProductVariants (children)
      const variantResults = [];

      for (const [color, colorGroup] of colorGroups.entries()) {
        const colorVariants = colorGroup.variants;

        for (let i = 0; i < colorVariants.length; i++) {
          const variantRawData = colorVariants[i];
          const isPrimary = (i === 0); // First variant of each color is primary

          const variantData = variantTransformer.transform(
            variantRawData,
            productId,
            productData.name,
            isPrimary
          );

          const variantResult = await variantSyncService.createOrUpdate(variantData);
          variantResults.push(variantResult);
        }
      }

      strapi.log.info(`  ✓ ${aNumber}: Product + ${variantResults.length} variants`);

    } catch (error) {
      strapi.log.error(`Failed to process product family ${aNumber}:`, error);
      throw error;
    }
  },

  /**
   * Import categories from CAT.csv
   */
  async importCategories() {
    try {
      strapi.log.info('🏷️  Importing categories from CAT.csv...');

      const categories = await categoryParser.parseCategories();
      strapi.log.info(`✓ Parsed ${categories.length} categories`);

      let createdCount = 0;
      let updatedCount = 0;

      for (const categoryData of categories) {
        // Use Strapi 5 Document API instead of legacy query API
        const existing = await strapi.documents('api::category.category').findMany({
          filters: { code: categoryData.code },
          limit: 1
        });

        if (existing && existing.length > 0) {
          await strapi.documents('api::category.category').update({
            documentId: existing[0].documentId,
            data: categoryData
          });
          updatedCount++;
        } else {
          await strapi.documents('api::category.category').create({
            data: categoryData
          });
          createdCount++;
        }
      }

      strapi.log.info(`✅ Categories imported: ${createdCount} created, ${updatedCount} updated`);

      return {
        success: true,
        total: categories.length,
        created: createdCount,
        updated: updatedCount
      };

    } catch (error) {
      strapi.log.error('Category import failed:', error);
      throw error;
    }
  },

  /**
   * Get sync status for all suppliers
   */
  async getSyncStatus() {
    try {
      const suppliers = await strapi.documents('api::supplier.supplier').findMany({
        filters: { is_active: true },
        populate: ['sync_configuration'] as any,
        pagination: { page: 1, pageSize: 100 }
      });

      const status = suppliers.map(supplier => {
        const syncConfig = (supplier as any).sync_configuration;

        return {
          supplier: {
            code: supplier.code,
            name: supplier.name,
            id: supplier.id
          },
          lastSync: syncConfig?.last_sync_date || null,
          status: syncConfig?.sync_status || 'never_synced',
          productsCount: syncConfig?.products_count || 0,
          hash: syncConfig?.last_import_hash || null
        };
      });

      return status;

    } catch (error) {
      strapi.log.error('Failed to get sync status:', error);
      throw error;
    }
  },

  /**
   * Get sync history/logs
   */
  async getSyncHistory(params: { page: number; pageSize: number }) {
    try {
      const { page = 1, pageSize = 25 } = params;

      const syncs = await strapi.documents('api::promidata-sync.promidata-sync').findMany({
        sort: { createdAt: 'desc' },
        pagination: { page, pageSize },
        populate: ['supplier'] as any
      });

      return syncs;

    } catch (error) {
      strapi.log.error('Failed to get sync history:', error);
      throw error;
    }
  },

  /**
   * Test connection to Promidata API
   */
  async testConnection() {
    try {
      strapi.log.info('🔌 Testing Promidata API connection...');

      // Test Import.txt endpoint
      const importData = await promidataClient.fetchText(
        'https://promi-dl.de/Profiles/Live/849c892e-b443-4f49-be3a-61a351cbdd23/Import/Import.txt'
      );

      const lineCount = importData.split('\n').filter(l => l.trim()).length;

      strapi.log.info(`✅ Connection successful - ${lineCount} entries found in Import.txt`);

      return {
        success: true,
        message: 'Connection to Promidata API successful',
        entriesFound: lineCount
      };

    } catch (error) {
      strapi.log.error('Connection test failed:', error);
      throw error;
    }
  },

  /**
   * Get job status and progress
   * Retrieves detailed information about a specific job
   */
  async getJobStatus(queueName: 'supplier-sync' | 'product-family' | 'image-upload', jobId: string) {
    try {
      const job = await queueService.getJob(queueName, jobId);

      if (!job) {
        return {
          found: false,
          message: `Job ${jobId} not found in queue ${queueName}`
        };
      }

      const state = await job.getState();
      const progress = job.progress;
      const returnValue = job.returnvalue;
      const failedReason = job.failedReason;

      return {
        found: true,
        jobId: job.id,
        queueName,
        state,
        progress,
        result: returnValue,
        error: failedReason,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        timestamp: job.timestamp
      };

    } catch (error) {
      strapi.log.error(`Failed to get job status for ${jobId}:`, error);
      throw error;
    }
  },

  /**
   * Get queue statistics
   * Returns counts of jobs in different states
   */
  async getQueueStats(queueName?: 'supplier-sync' | 'product-family' | 'image-upload') {
    try {
      if (queueName) {
        return await queueService.getQueueStats(queueName);
      } else {
        return await queueService.getAllStats();
      }
    } catch (error) {
      strapi.log.error('Failed to get queue stats:', error);
      throw error;
    }
  },

  /**
   * Get all jobs for a specific supplier
   * Useful for tracking all jobs related to a supplier sync
   */
  async getSupplierJobs(supplierCode: string, limit: number = 10) {
    try {
      // This would require querying jobs by supplier code
      // For now, return queue stats
      return {
        supplierCode,
        message: 'Job history tracking coming in Phase 4',
        queueStats: await this.getQueueStats()
      };
    } catch (error) {
      strapi.log.error(`Failed to get jobs for supplier ${supplierCode}:`, error);
      throw error;
    }
  }
}));
