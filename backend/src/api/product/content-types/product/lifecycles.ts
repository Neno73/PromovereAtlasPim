/**
 * Product Lifecycle Hooks
 *
 * Automatically syncs products to Meilisearch search index when:
 * - Product is created (afterCreate)
 * - Product is updated (afterUpdate)
 * - Product is deleted (afterDelete)
 *
 * Uses BullMQ queue for async, non-blocking sync operations.
 */

import queueService from '../../../../services/queue/queue-service';

export default {
  /**
   * After product creation - enqueue Meilisearch 'add' operation
   */
  async afterCreate(event) {
    const { result } = event;

    // Only sync active products (optional: could sync all and filter in Meilisearch)
    if (result.is_active === false) {
      strapi.log.debug(`Skipping Meilisearch sync for inactive product: ${result.sku}`);
      return;
    }

    try {
      // Enqueue Meilisearch sync job (non-blocking)
      await queueService.enqueueMeilisearchSync(
        'add',
        'product',
        result.id,
        result.documentId,
        10 // Higher priority for user-initiated creates
      );

      strapi.log.debug(`✅ Enqueued Meilisearch add for product: ${result.sku} (${result.documentId})`);
    } catch (error) {
      // Log error but don't throw - product creation should succeed even if indexing fails
      strapi.log.error(`❌ Failed to enqueue Meilisearch sync for product ${result.sku}:`, error);
    }
  },

  /**
   * After product update - enqueue Meilisearch 'update' operation
   */
  async afterUpdate(event) {
    const { result } = event;

    try {
      // If product was deactivated, delete from Meilisearch
      if (result.is_active === false) {
        await queueService.enqueueMeilisearchSync(
          'delete',
          'product',
          result.id,
          result.documentId,
          5 // Medium priority for deletes
        );
        strapi.log.debug(`✅ Enqueued Meilisearch delete for deactivated product: ${result.sku}`);
      } else {
        // Otherwise, update the document
        await queueService.enqueueMeilisearchSync(
          'update',
          'product',
          result.id,
          result.documentId,
          8 // High priority for user-initiated updates
        );
        strapi.log.debug(`✅ Enqueued Meilisearch update for product: ${result.sku} (${result.documentId})`);
      }
    } catch (error) {
      strapi.log.error(`❌ Failed to enqueue Meilisearch sync for product ${result.sku}:`, error);
    }
  },

  /**
   * After product deletion - enqueue Meilisearch 'delete' operation
   */
  async afterDelete(event) {
    const { result } = event;

    try {
      // Enqueue Meilisearch delete job
      await queueService.enqueueMeilisearchSync(
        'delete',
        'product',
        result.id,
        result.documentId,
        5 // Medium priority for deletes
      );

      strapi.log.debug(`✅ Enqueued Meilisearch delete for product: ${result.sku} (${result.documentId})`);
    } catch (error) {
      strapi.log.error(`❌ Failed to enqueue Meilisearch delete for product ${result.sku}:`, error);
    }
  },
};
