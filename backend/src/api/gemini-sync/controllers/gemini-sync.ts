/**
 * Gemini Sync Controller
 */

import queueService from '../../../services/queue/queue-service';
import { sanitizeError } from '../../../utils/error-sanitizer';
import { syncLockService } from '../../../services/sync-lock-service';
import { Queue } from 'bullmq';
import { getRedisConnection } from '../../../services/queue/queue-config';

export default {

  /**
   * Initialize Gemini FileSearchStore
   * @route POST /api/gemini-sync/init
   * @group Gemini Sync - Operations for syncing products to Gemini RAG
   * @returns {object} 200 - Success response
   * @returns {Error} 500 - Server error
   */
  async init(ctx) {
    try {
      ctx.body = {
        success: true,
        message: 'Gemini Service initialized (using Files API)'
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Trigger full sync of all products to Gemini
   * @route POST /api/gemini-sync/trigger-all
   * @group Gemini Sync - Operations for syncing products to Gemini RAG
   * @returns {object} 200 - Success response with background job started
   * @returns {Error} 500 - Server error
   */
  async triggerAll(ctx) {
    try {
      // Check if full sync is already running
      const syncId = await syncLockService.acquireGeminiLock('all');
      if (!syncId) {
        ctx.body = {
          success: false,
          message: 'Full Gemini sync already running',
          isRunning: true
        };
        return;
      }

      strapi.log.info('🚀 Starting full Gemini Sync...');

      // Run in background to avoid timeout
      processFullSync('all', syncId);

      ctx.body = {
        success: true,
        message: 'Full sync started in background. Check logs for progress.',
        syncId
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Get Gemini File Search statistics
   * @route GET /api/gemini-sync/stats
   * @group Gemini Sync - Operations for syncing products to Gemini RAG
   * @returns {object} 200 - Success response with stats
   * @returns {Error} 500 - Server error
   */
  async stats(ctx) {
    try {
      // API service  in src/api/gemini-sync/services/gemini-file-search.ts
      // @ts-ignore
      const geminiService = strapi.service('api::gemini-sync.gemini-file-search');

      const stats = await geminiService.getStats();
      const health = await geminiService.healthCheck();

      ctx.body = {
        success: true,
        stats,
        health
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Trigger Gemini sync for all products from a specific supplier
   * @route POST /api/gemini-sync/trigger-by-supplier
   * @group Gemini Sync - Operations for syncing products to Gemini RAG
   * @returns {object} 200 - Success response with background job started
   * @returns {Error} 500 - Server error
   */
  async triggerBySupplier(ctx) {
    try {
      const { supplierCode } = ctx.request.body;

      if (!supplierCode) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: 'supplierCode is required'
        };
        return;
      }

      // Check if sync is already running for this supplier
      const syncId = await syncLockService.acquireGeminiLock(supplierCode);
      if (!syncId) {
        ctx.body = {
          success: false,
          message: `Gemini sync already running for supplier ${supplierCode}`,
          isRunning: true
        };
        return;
      }

      strapi.log.info(`🚀 Starting Gemini Sync for supplier: ${supplierCode}...`);

      // Run in background to avoid timeout
      processSupplierSync(supplierCode, syncId);

      ctx.body = {
        success: true,
        message: `Gemini sync started for supplier ${supplierCode}. Check logs for progress.`,
        syncId
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Get Gemini sync status for a supplier
   * @route GET /api/gemini-sync/status/:supplierCode
   */
  async getGeminiSyncStatus(ctx) {
    try {
      const { supplierCode } = ctx.params;

      if (!supplierCode) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: 'supplierCode is required'
        };
        return;
      }

      const status = await syncLockService.getGeminiStatus(supplierCode);

      ctx.body = {
        success: true,
        data: {
          supplierCode,
          isRunning: status.isRunning,
          stopRequested: status.stopRequested,
          lockInfo: status.lockInfo
        }
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Stop a running Gemini sync
   * @route POST /api/gemini-sync/stop/:supplierCode
   */
  async stopGeminiSync(ctx) {
    try {
      const { supplierCode } = ctx.params;

      if (!supplierCode) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: 'supplierCode is required'
        };
        return;
      }

      // Request stop
      const stopRequested = await syncLockService.requestGeminiStop(supplierCode);

      if (!stopRequested) {
        ctx.body = {
          success: false,
          message: `No Gemini sync is currently running for ${supplierCode}`
        };
        return;
      }

      // Also drain the gemini-sync queue to remove pending jobs
      try {
        const geminiQueue = new Queue('gemini-sync', { connection: getRedisConnection() });
        await geminiQueue.drain();
        await geminiQueue.close();
        strapi.log.info(`[GeminiSync] Drained queue for ${supplierCode}`);
      } catch (drainError) {
        strapi.log.warn(`[GeminiSync] Could not drain queue: ${drainError.message}`);
      }

      ctx.body = {
        success: true,
        message: `Stop signal sent for ${supplierCode}. Sync will stop after current batch completes.`
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Get all active Gemini syncs
   * @route GET /api/gemini-sync/active
   */
  async getActiveGeminiSyncs(ctx) {
    try {
      const activeSyncs = await syncLockService.getAllActiveSyncs();

      ctx.body = {
        success: true,
        data: activeSyncs.gemini
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Get FileSearchStore information and details
   * @route GET /api/gemini-sync/store-info
   */
  async getStoreInfo(ctx) {
    try {
      // @ts-ignore
      const geminiService = strapi.service('api::gemini-sync.gemini-file-search');

      const storeInfo = await geminiService.getStoreInfo();

      ctx.body = {
        success: true,
        data: storeInfo
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Test semantic search against FileSearchStore
   * @route POST /api/gemini-sync/test-search
   */
  async testSearch(ctx) {
    try {
      // Frontend sends { data: { query: "..." } } via useFetchClient
      const { query } = ctx.request.body.data || ctx.request.body;

      if (!query) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: 'query is required'
        };
        return;
      }

      // @ts-ignore
      const geminiService = strapi.service('api::gemini-sync.gemini-file-search');

      const result = await geminiService.testSemanticSearch(query);

      ctx.body = {
        success: true,
        data: result
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * List all FileSearchStores
   * @route GET /api/gemini-sync/stores
   */
  async listStores(ctx) {
    try {
      // @ts-ignore
      const geminiService = strapi.service('api::gemini-sync.gemini-file-search');
      const stores = await geminiService.listAllStores();

      ctx.body = {
        success: true,
        data: stores
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Create a new FileSearchStore
   * @route POST /api/gemini-sync/stores/create
   */
  async createStore(ctx) {
    try {
      const { displayName } = ctx.request.body;

      if (!displayName) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: 'displayName is required'
        };
        return;
      }

      // @ts-ignore
      const geminiService = strapi.service('api::gemini-sync.gemini-file-search');
      const result = await geminiService.createNewStore(displayName);

      ctx.body = result;
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Delete a FileSearchStore
   * @route DELETE /api/gemini-sync/stores/:storeId
   */
  async deleteStore(ctx) {
    try {
      const { storeId } = ctx.params;
      const { force } = ctx.request.body || {};

      if (!storeId) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: 'storeId is required'
        };
        return;
      }

      // @ts-ignore
      const geminiService = strapi.service('api::gemini-sync.gemini-file-search');
      const result = await geminiService.deleteStoreById(storeId, force);

      ctx.body = result;
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Get detailed statistics including active/pending/failed document counts
   * @route GET /api/gemini-sync/detailed-stats
   */
  async getDetailedStats(ctx) {
    try {
      // @ts-ignore
      const geminiService = strapi.service('api::gemini-sync.gemini-file-search');
      const result = await geminiService.getDetailedStats();

      ctx.body = result;
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Get search history
   * @route GET /api/gemini-sync/search-history
   */
  async getSearchHistory(ctx) {
    try {
      const { limit } = ctx.query;

      // @ts-ignore
      const geminiService = strapi.service('api::gemini-sync.gemini-file-search');
      const history = await geminiService.getSearchHistory(limit ? parseInt(limit) : 10);

      ctx.body = {
        success: true,
        data: history
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Run reconciliation: compare tracking vs actual FileSearchStore
   * @route POST /api/gemini-sync/reconcile
   * @description Samples products with gemini_file_uri and verifies via semantic search
   * @returns {object} { total, sampled, verified, missing, products: [] }
   */
  async reconcile(ctx) {
    try {
      const { sampleSize = 50 } = ctx.request.body || {};

      // Limit sample size to prevent abuse
      const actualSampleSize = Math.min(Math.max(sampleSize, 10), 100);

      strapi.log.info(`[Reconciliation] Starting reconciliation with sample size: ${actualSampleSize}`);

      // Get products that claim to be synced (have gemini_file_uri)
      const syncedProducts = await strapi.db.query('api::product.product').findMany({
        where: {
          gemini_file_uri: { $notNull: true }
        },
        select: ['id', 'documentId', 'sku', 'name', 'gemini_file_uri', 'promidata_hash', 'gemini_synced_hash'],
        limit: actualSampleSize,
        orderBy: { updatedAt: 'desc' }
      });

      // Get total count of synced products
      const totalCount = await strapi.db.query('api::product.product').count({
        where: {
          gemini_file_uri: { $notNull: true }
        }
      });

      // @ts-ignore
      const geminiService = strapi.service('api::gemini-sync.gemini-file-search');

      const results = {
        total: totalCount,
        sampled: syncedProducts.length,
        verified: 0,
        missing: 0,
        hashMismatch: 0,
        products: [] as Array<{
          documentId: string;
          sku: string;
          name: any;
          gemini_file_uri: string;
          found: boolean;
          hashMatches: boolean;
        }>
      };

      // Verify each sampled product
      for (const product of syncedProducts) {
        try {
          // Use semantic search with product SKU
          const searchQuery = `product SKU ${product.sku}`;
          const searchResult = await geminiService.testSemanticSearch(searchQuery);

          // Check if product was found in the response text
          let found = false;
          if (searchResult?.success && searchResult?.responseText) {
            const responseText = searchResult.responseText.toLowerCase();
            const skuLower = product.sku.toLowerCase();

            if (responseText.includes(skuLower)) {
              found = true;
            }

            // Also check for partial SKU match (without variant suffix)
            if (!found) {
              const skuBase = product.sku.split('-').slice(0, -1).join('-').toLowerCase();
              if (skuBase && responseText.includes(skuBase)) {
                found = true;
              }
            }
          }

          const hashMatches = product.promidata_hash === product.gemini_synced_hash;

          if (found) {
            results.verified++;
          } else {
            results.missing++;
          }

          if (!hashMatches) {
            results.hashMismatch++;
          }

          results.products.push({
            documentId: product.documentId,
            sku: product.sku,
            name: product.name,
            gemini_file_uri: product.gemini_file_uri,
            found,
            hashMatches
          });

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          strapi.log.warn(`[Reconciliation] Failed to verify product ${product.sku}:`, err.message);
          results.products.push({
            documentId: product.documentId,
            sku: product.sku,
            name: product.name,
            gemini_file_uri: product.gemini_file_uri,
            found: false,
            hashMatches: false
          });
          results.missing++;
        }
      }

      strapi.log.info(`[Reconciliation] Complete: ${results.verified}/${results.sampled} verified, ${results.missing} missing`);

      ctx.body = {
        success: true,
        data: results
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  },

  /**
   * Verify if a product exists in Gemini FileSearchStore
   * @route POST /api/gemini-sync/verify-product/:documentId
   * @description Uses semantic search to verify if product chunks exist in FileSearchStore
   * @returns {object} { found: boolean, chunks: number, product: { sku, name } }
   */
  async verifyProduct(ctx) {
    try {
      const { documentId } = ctx.params;

      if (!documentId) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: 'documentId is required'
        };
        return;
      }

      // Get product from database
      const product = await strapi.documents('api::product.product').findOne({
        documentId,
        fields: ['sku', 'name', 'a_number', 'promidata_hash', 'gemini_synced_hash', 'gemini_file_uri']
      });

      if (!product) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: `Product with documentId ${documentId} not found`
        };
        return;
      }

      // @ts-ignore
      const geminiService = strapi.service('api::gemini-sync.gemini-file-search');

      // Use semantic search with product SKU to verify existence
      const searchQuery = `product SKU ${product.sku}`;
      const searchResult = await geminiService.testSemanticSearch(searchQuery);

      // Count chunks that mention this product's SKU
      let chunksFound = 0;
      let found = false;

      // The testSemanticSearch returns { success, query, responseText, fullResponse }
      // Check if the SKU appears in the AI's response text
      if (searchResult?.success && searchResult?.responseText) {
        // Check if SKU is mentioned in the response (case-insensitive)
        const responseText = searchResult.responseText.toLowerCase();
        const skuLower = product.sku.toLowerCase();

        if (responseText.includes(skuLower)) {
          found = true;
          chunksFound = 1;
        }

        // Also check for partial SKU match (without variant suffix)
        // e.g., "A109-HX-YL" might be mentioned even if full "A109-HX-YL-RED" isn't
        const skuBase = product.sku.split('-').slice(0, -1).join('-').toLowerCase();
        if (!found && skuBase && responseText.includes(skuBase)) {
          found = true;
          chunksFound = 1;
        }
      }

      // Try to extract grounding chunks from fullResponse if available
      // Gemini API may include grounding metadata
      if (searchResult?.fullResponse) {
        const fullResp = searchResult.fullResponse;
        // Check various possible locations for grounding data
        const groundingMeta = fullResp.candidates?.[0]?.groundingMetadata;
        if (groundingMeta?.retrievalQueries?.length) {
          chunksFound = Math.max(chunksFound, groundingMeta.retrievalQueries.length);
        }
        if (groundingMeta?.groundingChunks?.length) {
          chunksFound = Math.max(chunksFound, groundingMeta.groundingChunks.length);
        }
      }

      // Get tracking status from product fields
      // If found in store, consider it synced even without tracking field
      const trackingStatus = {
        hasGeminiUri: !!product.gemini_file_uri,
        foundInStore: found, // Add this for better status display
        hashMatch: product.promidata_hash === product.gemini_synced_hash,
        promidataHash: product.promidata_hash,
        geminiSyncedHash: product.gemini_synced_hash
      };

      ctx.body = {
        success: true,
        data: {
          found,
          chunks: chunksFound,
          responseText: searchResult?.responseText || '', // Include the AI response text
          groundingChunks: searchResult?.groundingChunks || [], // Include raw document chunks
          product: {
            documentId,
            sku: product.sku,
            name: product.name,
            a_number: product.a_number
          },
          tracking: trackingStatus,
          searchQuery
        }
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: sanitizeError(error)
      };
    }
  }

};

/**
 * Background process for full sync
 */
async function processFullSync(lockKey: string, syncId: string) {
  try {
    const batchSize = 50;
    let start = 0;  // Use start/limit for Strapi 5 Document Service (NOT page/pageSize!)
    let processed = 0;
    let errors = 0;
    let stopped = false;

    while (true) {
      // Check for stop signal between batches
      const shouldStop = await syncLockService.isGeminiStopRequested(lockKey);
      if (shouldStop) {
        strapi.log.info(`[GeminiSync] Stop signal received. Stopping full sync...`);
        stopped = true;
        break;
      }

      // IMPORTANT: Strapi 5 Document Service uses start/limit, NOT page/pageSize!
      // Using wrong format causes pagination to be ignored → infinite loop!
      // HASH-BASED DEDUPLICATION: Only sync products that:
      // 1. Have never been synced (gemini_synced_hash is null), OR
      // 2. Have been updated since last sync (promidata_hash != gemini_synced_hash)
      const products = await strapi.documents('api::product.product').findMany({
        filters: {
          $or: [
            { gemini_synced_hash: { $null: true } },  // Never synced to Gemini
            {
              $and: [
                { promidata_hash: { $notNull: true } },
                { $not: { promidata_hash: { $eq: '$gemini_synced_hash' } } }  // Hash changed
              ]
            }
          ]
        },
        start,
        limit: batchSize,
        // No need to populate relations for queue job, just need documentId
        fields: ['sku']
      });

      if (products.length === 0) break;

      strapi.log.info(`[GeminiSync] Enqueuing batch (offset ${start}, ${products.length} products)...`);

      try {
        const jobs = products.map(product => ({
          operation: 'update' as const,
          documentId: product.documentId
        }));

        await queueService.enqueueGeminiSyncBatch(jobs);
        processed += products.length;
      } catch (err) {
        strapi.log.error(`[GeminiSync] Failed to enqueue batch at offset ${start}:`, err);
        errors += products.length;
      }

      start += products.length;
    }

    if (stopped) {
      strapi.log.info(`⏹️ Full Gemini Sync stopped. Jobs created: ${processed}, Failed: ${errors}`);
    } else {
      strapi.log.info(`✅ Full Gemini Sync Enqueued. Jobs created: ${processed}, Failed batches: ${errors}`);
    }

  } catch (error) {
    strapi.log.error('[GeminiSync] Full sync failed:', error);
  } finally {
    // Always release lock
    await syncLockService.releaseGeminiLock(lockKey);
  }
}

/**
 * Background process for supplier sync
 */
async function processSupplierSync(supplierCode: string, syncId: string) {
  try {
    const batchSize = 50;
    let start = 0;  // Use start/limit for Strapi 5 Document Service (NOT page/pageSize!)
    let processed = 0;
    let errors = 0;
    let stopped = false;

    while (true) {
      // Check for stop signal between batches
      const shouldStop = await syncLockService.isGeminiStopRequested(supplierCode);
      if (shouldStop) {
        strapi.log.info(`[GeminiSync] Stop signal received for ${supplierCode}. Stopping...`);
        stopped = true;
        break;
      }

      // IMPORTANT: Strapi 5 Document Service uses start/limit, NOT page/pageSize!
      // Using wrong format causes pagination to be ignored → infinite loop!
      // HASH-BASED DEDUPLICATION: Only sync products that:
      // 1. Have never been synced (gemini_synced_hash is null), OR
      // 2. Have been updated since last sync (promidata_hash != gemini_synced_hash)
      const products = await strapi.documents('api::product.product').findMany({
        filters: {
          supplier: {
            code: supplierCode
          },
          $or: [
            { gemini_synced_hash: { $null: true } },  // Never synced to Gemini
            {
              $and: [
                { promidata_hash: { $notNull: true } },
                { $not: { promidata_hash: { $eq: '$gemini_synced_hash' } } }  // Hash changed
              ]
            }
          ]
        },
        start,
        limit: batchSize,
        fields: ['sku']
      });

      if (products.length === 0) break;

      strapi.log.info(`[GeminiSync] Enqueuing batch (offset ${start}) for supplier ${supplierCode} (${products.length} products)...`);

      try {
        const jobs = products.map(product => ({
          operation: 'update' as const,
          documentId: product.documentId
        }));

        await queueService.enqueueGeminiSyncBatch(jobs);
        processed += products.length;
      } catch (err) {
        strapi.log.error(`[GeminiSync] Failed to enqueue batch at offset ${start}:`, err);
        errors += products.length;
      }

      start += products.length;
    }

    if (stopped) {
      strapi.log.info(`⏹️ Gemini Sync stopped for supplier ${supplierCode}. Jobs created: ${processed}, Failed: ${errors}`);
    } else {
      strapi.log.info(`✅ Gemini Sync Enqueued for supplier ${supplierCode}. Jobs created: ${processed}, Failed: ${errors}`);
    }

  } catch (error) {
    strapi.log.error(`[GeminiSync] Supplier sync failed for ${supplierCode}:`, error);
  } finally {
    // Always release lock
    await syncLockService.releaseGeminiLock(supplierCode);
  }
}
