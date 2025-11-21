/**
 * Gemini Sync Controller
 */

import queueService from '../../../services/queue/queue-service';
import { sanitizeError } from '../../../utils/error-sanitizer';

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
      strapi.log.info('🚀 Starting full Gemini Sync...');

      // Run in background to avoid timeout
      // We need to bind 'this' or call a service method. 
      // Since this is a plain object, 'this.processFullSync' works if defined here.
      processFullSync();

      ctx.body = {
        success: true,
        message: 'Full sync started in background. Check logs for progress.'
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
async function processFullSync() {
  try {
    const batchSize = 50;
    let page = 1;
    let processed = 0;
    let errors = 0;

    while (true) {
      const products = await strapi.documents('api::product.product').findMany({
        pagination: { page, pageSize: batchSize },
        // No need to populate relations for queue job, just need documentId
        fields: ['sku']
      });

      if (products.length === 0) break;

      strapi.log.info(`[GeminiSync] Enqueuing batch ${page} (${products.length} products)...`);

      try {
        const jobs = products.map(product => ({
          operation: 'update' as const,
          documentId: product.documentId
        }));

        await queueService.enqueueGeminiSyncBatch(jobs);
        processed += products.length;
      } catch (err) {
        strapi.log.error(`[GeminiSync] Failed to enqueue batch ${page}:`, err);
        errors += products.length;
      }

      page++;
    }

    strapi.log.info(`✅ Full Gemini Sync Enqueued. Jobs created: ${processed}, Failed batches: ${errors}`);

  } catch (error) {
    strapi.log.error('[GeminiSync] Full sync failed:', error);
  }
}
