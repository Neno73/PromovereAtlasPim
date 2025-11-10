/**
 * Product Variant Lifecycle Hooks
 *
 * Automatically syncs parent product to Meilisearch when variants change.
 * Since variants are aggregated into the product document (colors, sizes, etc.),
 * any variant change requires re-indexing the parent product.
 *
 * Uses BullMQ queue for async, non-blocking sync operations.
 */

import queueService from '../../../../services/queue/queue-service';

export default {
  /**
   * After variant creation - re-index parent product
   */
  async afterCreate(event) {
    const { result } = event;

    try {
      // Enqueue sync for the variant itself
      // Note: The worker will re-index the parent product, not the variant directly
      await queueService.enqueueMeilisearchSync(
        'update', // Use 'update' operation since parent product exists
        'product-variant',
        result.id,
        result.documentId,
        7 // Medium-high priority
      );

      strapi.log.debug(`✅ Enqueued Meilisearch sync for new variant: ${result.sku}`);
    } catch (error) {
      strapi.log.error(`❌ Failed to enqueue Meilisearch sync for variant ${result.sku}:`, error);
    }
  },

  /**
   * After variant update - re-index parent product
   */
  async afterUpdate(event) {
    const { result } = event;

    try {
      // Re-index parent product with updated variant data
      await queueService.enqueueMeilisearchSync(
        'update',
        'product-variant',
        result.id,
        result.documentId,
        6 // Medium priority for updates
      );

      strapi.log.debug(`✅ Enqueued Meilisearch sync for updated variant: ${result.sku}`);
    } catch (error) {
      strapi.log.error(`❌ Failed to enqueue Meilisearch sync for variant ${result.sku}:`, error);
    }
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
