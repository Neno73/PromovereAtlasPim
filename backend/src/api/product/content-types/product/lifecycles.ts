/**
 * Product Lifecycle Hooks
 * Handles real-time AutoRAG sync when products are created, updated, or deleted
 */

const autoragService = require('../../../../services/autorag').default;

export default {
  /**
   * Hook called after product creation
   */
  async afterCreate(event: any) {
    const { result } = event;
    
    try {
      await syncProductToAutoRAG(result, 'create');
    } catch (error) {
      strapi.log.error('Failed to sync new product to AutoRAG:', error);
    }
  },

  /**
   * Hook called after product update
   */
  async afterUpdate(event: any) {
    const { result } = event;
    
    try {
      await syncProductToAutoRAG(result, 'update');
    } catch (error) {
      strapi.log.error('Failed to sync updated product to AutoRAG:', error);
    }
  },

  /**
   * Hook called after product deletion
   */
  async afterDelete(event: any) {
    const { result } = event;
    
    try {
      await syncProductToAutoRAG(result, 'delete');
    } catch (error) {
      strapi.log.error('Failed to delete product from AutoRAG:', error);
    }
  },
};

/**
 * Sync a single product to AutoRAG
 */
async function syncProductToAutoRAG(product: any, action: 'create' | 'update' | 'delete') {
  // Skip sync if product is not active
  if (action !== 'delete' && !product.is_active) {
    strapi.log.debug(`Skipping AutoRAG sync for inactive product ${product.sku}`);
    return;
  }

  // Get supplier information with AutoRAG config
  let supplierWithConfig;
  try {
    supplierWithConfig = await strapi.documents('api::supplier.supplier').findOne({
      documentId: product.supplier?.documentId || product.supplier?.id,
      populate: ['autorag_config']
    });
  } catch (error) {
    strapi.log.error('Failed to fetch supplier with AutoRAG config:', error);
    return;
  }

  if (!supplierWithConfig?.autorag_config) {
    strapi.log.debug(`No AutoRAG config for supplier ${supplierWithConfig?.code || 'unknown'}, skipping sync`);
    return;
  }

  const autoragConfig = supplierWithConfig.autorag_config;
  
  // Skip if AutoRAG is not active or real-time sync is disabled
  if (autoragConfig.status !== 'active' || autoragConfig.sync_frequency !== 'real-time') {
    strapi.log.debug(`AutoRAG not configured for real-time sync for supplier ${supplierWithConfig.code}`);
    return;
  }

  const config = {
    autorag_id: autoragConfig.autorag_id,
    cloudflare_account_id: autoragConfig.cloudflare_account_id,
    api_endpoint: autoragConfig.api_endpoint
  };

  // Perform the sync action
  let success = false;
  
  try {
    if (action === 'delete') {
      success = await autoragService.deleteProduct(
        config,
        supplierWithConfig.code,
        product.sku
      );
      
      if (success) {
        strapi.log.info(`🗑️ Deleted product ${product.sku} from AutoRAG ${config.autorag_id}`);
        
        // Update product count
        await updateAutoRAGProductCount(autoragConfig.documentId, -1);
      }
      
    } else {
      // Get full product data with relations
      const fullProduct = await strapi.documents('api::product.product').findOne({
        documentId: product.documentId,
        populate: ['categories', 'main_image', 'gallery_images', 'supplier']
      });
      
      if (!fullProduct) {
        strapi.log.error(`Product ${product.sku} not found for AutoRAG sync`);
        return;
      }
      
      const transformedProduct = autoragService.transformProductForAutoRAG(fullProduct);
      
      success = await autoragService.uploadProduct(config, transformedProduct);
      
      if (success) {
        const actionText = action === 'create' ? 'Added' : 'Updated';
        strapi.log.info(`✅ ${actionText} product ${product.sku} in AutoRAG ${config.autorag_id}`);
        
        // Update product count for new products
        if (action === 'create') {
          await updateAutoRAGProductCount(autoragConfig.documentId, 1);
        }
      }
    }
    
    // Update last sync status on success
    if (success) {
      await strapi.documents('api::supplier-autorag-config.supplier-autorag-config').update({
        documentId: autoragConfig.documentId,
        data: {
          last_sync_date: new Date(),
          last_sync_status: 'completed',
          last_sync_message: `Real-time sync: ${action}d product ${product.sku}`
        }
      });
    }
    
  } catch (error) {
    strapi.log.error(`Failed to ${action} product ${product.sku} in AutoRAG:`, error);
    
    // Update sync status to indicate failure
    await strapi.documents('api::supplier-autorag-config.supplier-autorag-config').update({
      documentId: autoragConfig.documentId,
      data: {
        last_sync_date: new Date(),
        last_sync_status: 'failed',
        last_sync_message: `Real-time sync failed: ${action} product ${product.sku} - ${error.message}`
      }
    });
  }
}

/**
 * Update product count in AutoRAG config
 */
async function updateAutoRAGProductCount(configDocumentId: string, delta: number) {
  try {
    const config = await strapi.documents('api::supplier-autorag-config.supplier-autorag-config').findOne({
      documentId: configDocumentId
    });
    
    if (config) {
      const newCount = Math.max(0, (config.products_in_autorag || 0) + delta);
      await strapi.documents('api::supplier-autorag-config.supplier-autorag-config').update({
        documentId: configDocumentId,
        data: {
          products_in_autorag: newCount
        }
      });
    }
  } catch (error) {
    strapi.log.error('Failed to update AutoRAG product count:', error);
  }
}