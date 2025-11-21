/**
 * Product Variant Lifecycle Hooks
 *
 * NOTE: afterCreate and afterUpdate disabled to prevent duplicate Meilisearch jobs.
 * Instead, Meilisearch sync is triggered manually at the end of product-family-worker
 * after all variant data (including images) is complete.
 *
 * Only afterDelete remains active since it's a one-time event.
 */

import queueService from '../../../../services/queue/queue-service';

export default {
  /**
   * After variant creation - DISABLED
   * Meilisearch sync is triggered manually by product-family-worker with delay
   */
  async afterCreate(event) {
    // DISABLED: Sync triggered manually in product-family-worker after images are uploaded
    // const { result } = event;
    // await queueService.enqueueMeilisearchSync('update', 'product-variant', result.id, result.documentId, 7);

    strapi.log.debug(`[Lifecycle] Variant created: ${event.result.sku} (Meilisearch sync deferred)`);
  },

  /**
   * After variant update - DISABLED
   * Meilisearch sync is triggered manually by product-family-worker with delay
   */
  async afterUpdate(event) {
    // DISABLED: Sync triggered manually in product-family-worker after images are uploaded
    // const { result } = event;
    // await queueService.enqueueMeilisearchSync('update', 'product-variant', result.id, result.documentId, 6);

    strapi.log.debug(`[Lifecycle] Variant updated: ${event.result.sku} (Meilisearch sync deferred)`);
  },

  /**
   * After variant deletion - re-index parent product
   */
  async afterDelete(event) {
    const { result } = event;

    try {
      // Re-index parent product (variant data removed)
      // Note: The worker needs the variant to fetch the parent product ID
      // Since the variant is already deleted, we need to handle this carefully
      // The worker will use the cached product relation if available
      await queueService.enqueueMeilisearchSync(
        'update',
        'product-variant',
        result.id,
        result.documentId,
        5 // Medium priority
      );

      strapi.log.debug(`✅ Enqueued Meilisearch sync for deleted variant: ${result.sku}`);
    } catch (error) {
      strapi.log.error(`❌ Failed to enqueue Meilisearch sync for deleted variant ${result.sku}:`, error);
    }
  },
};
