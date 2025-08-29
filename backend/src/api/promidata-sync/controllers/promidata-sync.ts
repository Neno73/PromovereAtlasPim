/**
 * Promidata Sync Controller
 * Handles API endpoints for managing Promidata synchronization
 */

// Define a simple context type
interface Context {
  request: {
    body: any;
  };
  params: any;
  query: any;
  body: any;
  set: (key: string, value: string) => void;
  badRequest: (message: string, details?: any) => void;
}

export default {
  /**
   * Start manual sync for all suppliers or a specific supplier
   */
  async startSync(ctx: Context) {
    try {
      const { supplierId } = ctx.request.body;
      
      // Get sync service
      const syncService = strapi.service('api::promidata-sync.promidata-sync');
      
      // Start sync
      const result = await syncService.startSync(supplierId);
      
      ctx.body = {
        success: true,
        message: 'Sync started successfully',
        data: result
      };
    } catch (error) {
      ctx.badRequest('Sync failed', { details: error.message });
    }
  },

  /**
   * Get sync status for all suppliers
   */
  async getSyncStatus(ctx: Context) {
    try {
      const syncService = strapi.service('api::promidata-sync.promidata-sync');
      const status = await syncService.getSyncStatus();
      
      ctx.body = {
        success: true,
        data: status
      };
    } catch (error) {
      ctx.badRequest('Failed to get sync status', { details: error.message });
    }
  },

  /**
   * Get sync history/logs
   */
  async getSyncHistory(ctx: Context) {
    try {
      const { page = 1, pageSize = 25 } = ctx.query;
      const syncService = strapi.service('api::promidata-sync.promidata-sync');
      
      const history = await syncService.getSyncHistory({
        page: Number(page),
        pageSize: Number(pageSize)
      });
      
      ctx.body = {
        success: true,
        data: history
      };
    } catch (error) {
      ctx.badRequest('Failed to get sync history', { details: error.message });
    }
  },

  /**
   * Import categories from CAT.csv
   */
  async importCategories(ctx: Context) {
    try {
      const syncService = strapi.service('api::promidata-sync.promidata-sync');
      const result = await syncService.importCategories();
      
      ctx.body = {
        success: true,
        message: 'Categories imported successfully',
        data: result
      };
    } catch (error) {
      ctx.badRequest('Category import failed', { details: error.message });
    }
  },

  /**
   * Test connection to Promidata API
   */
  async testConnection(ctx: Context) {
    try {
      const syncService = strapi.service('api::promidata-sync.promidata-sync');
      const result = await syncService.testConnection();
      
      ctx.body = {
        success: true,
        message: 'Connection test successful',
        data: result
      };
    } catch (error) {
      ctx.badRequest('Connection test failed', { details: error.message });
    }
  },

  /**
   * Export supplier products for vector database (legacy - single file)
   */
  async exportSupplierProducts(ctx: Context) {
    try {
      const { supplierId } = ctx.params;
      
      if (!supplierId) {
        ctx.badRequest('Supplier ID is required');
        return;
      }
      
      // Get supplier details using Strapi 5 Document Service API
      const supplier = await strapi.documents('api::supplier.supplier').findOne({
        documentId: supplierId
      });
      if (!supplier) {
        ctx.badRequest('Supplier not found');
        return;
      }
      
      // Get all products for this supplier using Strapi 5 Document Service API
      const products = await strapi.documents('api::product.product').findMany({
        filters: { 
          supplier: { 
            id: supplier.id // Use nested structure for relation filtering in Strapi 5
          },
          is_active: true 
        },
        populate: ['categories', 'price_tiers', 'main_image', 'gallery_images'],
        pagination: {
          page: 1,
          pageSize: 10000 // Large number to get all products
        }
      });
      
      // Build export data
      const exportData = {
        supplier: {
          code: supplier.code,
          name: supplier.name,
          exported_at: new Date().toISOString()
        },
        products: products.map(product => ({
          sku: product.sku,
          name: product.name,
          description: product.description,
          short_description: product.short_description,
          available_sizes: product.available_sizes || ['One Size'],
          size_skus: product.size_skus || {},
          color_name: product.color_name,
          color_code: product.color_code,
          hex_color: product.hex_color,
          material: product.material,
          brand: product.brand,
          categories: (product as any).categories?.map((cat: any) => cat.name) || [],
          pricing: {
            tiers: (product as any).price_tiers?.map((tier: any) => ({
              quantity: tier.quantity,
              price: tier.price
            })) || []
          },
          searchable_text: buildSearchableText(product),
          metadata: {
            variant_type: product.variant_type,
            last_synced: product.last_synced,
            strapi_id: product.id
          }
        })),
        metadata: {
          total_products: products.length,
          export_timestamp: new Date().toISOString(),
          supplier_code: supplier.code
        }
      };
      
      // Set response headers for file download
      ctx.set('Content-Type', 'application/json');
      ctx.set('Content-Disposition', `attachment; filename="${supplier.code}_products_export.json"`);
      
      ctx.body = JSON.stringify(exportData, null, 2);
      
    } catch (error) {
      strapi.log.error('Export failed:', error);
      ctx.badRequest('Export failed', { details: error.message });
    }
  },

  /**
   * Export and sync supplier products to AutoRAG (product-per-file)
   */
  async syncSupplierToAutoRAG(ctx: Context) {
    try {
      const { supplierId } = ctx.params;
      
      if (!supplierId) {
        ctx.badRequest('Supplier ID is required');
        return;
      }
      
      // Get supplier details using Strapi 5 Document Service API
      const supplier = await strapi.documents('api::supplier.supplier').findOne({
        documentId: supplierId,
        populate: ['autorag_config']
      });
      
      if (!supplier) {
        ctx.badRequest('Supplier not found');
        return;
      }
      
      // Check if AutoRAG config exists
      if (!supplier.autorag_config) {
        ctx.badRequest('AutoRAG configuration not found for this supplier. Please configure AutoRAG first.');
        return;
      }
      
      const autoragConfig = supplier.autorag_config;
      if (autoragConfig.status !== 'active') {
        ctx.badRequest('AutoRAG configuration is not active for this supplier');
        return;
      }
      
      // Get AutoRAG service
      const autoragService = require('../../../services/autorag').default;
      
      // Get all products for this supplier
      const products = await strapi.documents('api::product.product').findMany({
        filters: { 
          supplier: { 
            id: supplier.id
          },
          is_active: true 
        },
        populate: ['categories', 'main_image', 'gallery_images', 'supplier'],
        pagination: {
          page: 1,
          pageSize: 10000
        }
      });
      
      strapi.log.info(`🔄 Starting AutoRAG sync for ${supplier.code}: ${products.length} products`);
      
      // Transform products to AutoRAG format
      const transformedProducts = products.map(product => autoragService.transformProductForAutoRAG(product));
      
      // Update sync status
      await strapi.documents('api::supplier-autorag-config.supplier-autorag-config').update({
        documentId: autoragConfig.documentId,
        data: {
          last_sync_status: 'running',
          last_sync_date: new Date(),
          last_sync_message: `Syncing ${products.length} products...`
        }
      });
      
      // Upload products to AutoRAG in batches
      const result = await autoragService.bulkUploadProducts(
        {
          autorag_id: autoragConfig.autorag_id,
          cloudflare_account_id: autoragConfig.cloudflare_account_id,
          api_endpoint: autoragConfig.api_endpoint
        },
        transformedProducts
      );
      
      // Update sync status with results
      const syncStatus = result.failed === 0 ? 'completed' : 'failed';
      const syncMessage = `Sync completed: ${result.success} successful, ${result.failed} failed`;
      
      await strapi.documents('api::supplier-autorag-config.supplier-autorag-config').update({
        documentId: autoragConfig.documentId,
        data: {
          last_sync_status: syncStatus,
          last_sync_message: syncMessage,
          products_in_autorag: result.success,
          last_sync_date: new Date()
        }
      });
      
      strapi.log.info(`✅ AutoRAG sync completed for ${supplier.code}: ${result.success}/${products.length} products`);
      
      ctx.body = {
        success: true,
        message: 'AutoRAG sync completed',
        data: {
          supplier_code: supplier.code,
          total_products: products.length,
          successful_uploads: result.success,
          failed_uploads: result.failed,
          errors: result.errors
        }
      };
      
    } catch (error) {
      strapi.log.error('AutoRAG sync failed:', error);
      
      // Try to update status to failed
      try {
        const { supplierId } = ctx.params;
        const supplier = await strapi.documents('api::supplier.supplier').findOne({
          documentId: supplierId,
          populate: ['autorag_config']
        });
        
        if (supplier?.autorag_config) {
          await strapi.documents('api::supplier-autorag-config.supplier-autorag-config').update({
            documentId: supplier.autorag_config.documentId,
            data: {
              last_sync_status: 'failed',
              last_sync_message: `Sync failed: ${error.message}`,
              last_sync_date: new Date()
            }
          });
        }
      } catch (updateError) {
        strapi.log.error('Failed to update sync status:', updateError);
      }
      
      ctx.badRequest('AutoRAG sync failed', { details: error.message });
    }
  }
};

/**
 * Build searchable text content for vector database
 */
function buildSearchableText(product: any): string {
  const textParts: string[] = [];
  
  // Add product name in all languages
  if (product.name) {
    Object.values(product.name).forEach(name => {
      if (name && typeof name === 'string') {
        textParts.push(name);
      }
    });
  }
  
  // Add descriptions
  if (product.description) {
    Object.values(product.description).forEach(desc => {
      if (desc && typeof desc === 'string') {
        textParts.push(desc);
      }
    });
  }
  
  // Add short descriptions
  if (product.short_description) {
    Object.values(product.short_description).forEach(desc => {
      if (desc && typeof desc === 'string') {
        textParts.push(desc);
      }
    });
  }
  
  // Add material info
  if (product.material) {
    Object.values(product.material).forEach(material => {
      if (material && typeof material === 'string') {
        textParts.push(material);
      }
    });
  }
  
  // Add brand and color info
  if (product.brand) textParts.push(product.brand);
  if (product.color_name) {
    Object.values(product.color_name).forEach(color => {
      if (color && typeof color === 'string') {
        textParts.push(color);
      }
    });
  }
  
  // Add categories
  if (product.categories && Array.isArray(product.categories)) {
    product.categories.forEach(cat => {
      if (cat.name) textParts.push(cat.name);
    });
  }
  
  // Add available sizes
  if (product.available_sizes && Array.isArray(product.available_sizes)) {
    textParts.push(...product.available_sizes);
  }
  
  return textParts.filter(Boolean).join(' ');
}