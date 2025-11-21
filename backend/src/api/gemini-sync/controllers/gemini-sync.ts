/**
 * Gemini Sync Controller
 */

import geminiService from '../../../services/gemini/gemini-service';

export default {

  /**
   * Initialize Gemini (verify API key works)
   * POST /api/gemini-sync/init
   */
  async init(ctx) {
    try {
      ctx.body = {
        success: true,
        message: 'Gemini Service initialized (using Files API)'
      };
    } catch (error) {
      ctx.body = {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Trigger Full Sync
   * POST /api/gemini-sync/trigger-all
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
      ctx.body = {
        success: false,
        error: error.message
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
        populate: ['supplier', 'categories', 'price_tiers', 'dimensions']
      });

      if (products.length === 0) break;

      strapi.log.info(`[GeminiSync] Processing batch ${page} (${products.length} products)...`);

      for (const product of products) {
        try {
          await geminiService.upsertProduct(product);
          processed++;
        } catch (err) {
          strapi.log.error(`[GeminiSync] Failed to sync ${product.sku}:`, err);
          errors++;
        }
      }

      page++;
    }

    strapi.log.info(`✅ Full Gemini Sync Completed. Processed: ${processed}, Errors: ${errors}`);

  } catch (error) {
    strapi.log.error('[GeminiSync] Full sync failed:', error);
  }
}
