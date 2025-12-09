/**
 * Promidata Sync Controller
 * Handles API endpoints for managing Promidata synchronization
 */

import queueService from '../../../services/queue/queue-service';
import { syncLockService } from '../../../services/sync-lock-service';

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
   * UPDATED: Now uses BullMQ queue with lock checking
   */
  async startSync(ctx: Context) {
    try {
      const { supplierId } = ctx.request.body;

      if (supplierId) {
        // Sync specific supplier via queue
        const supplier = await strapi.documents('api::supplier.supplier').findOne({
          documentId: supplierId
        });

        if (!supplier) {
          ctx.badRequest('Supplier not found');
          return;
        }

        // Check if sync is already running (via lock)
        const syncId = await syncLockService.acquirePromidataLock(supplierId);
        if (!syncId) {
          ctx.body = {
            success: false,
            message: `Sync already running for supplier ${supplier.code}`,
            isRunning: true
          };
          return;
        }

        // Update supplier status to 'running'
        await strapi.documents('api::supplier.supplier').update({
          documentId: supplierId,
          data: {
            last_sync_status: 'running',
            last_sync_message: `Sync started at ${new Date().toISOString()}`
          }
        });

        // Enqueue supplier sync job (pass syncId for lock tracking)
        const job = await queueService.enqueueSupplierSync(
          supplierId,
          supplier.code,
          Number(supplier.id) // numeric ID
        );

        ctx.body = {
          success: true,
          message: `Sync job enqueued for supplier ${supplier.code}`,
          data: {
            jobId: job.id,
            supplierId,
            supplierCode: supplier.code,
            syncId
          }
        };
      } else {
        // Sync all active suppliers via queue
        const suppliers = await strapi.documents('api::supplier.supplier').findMany({
          filters: { is_active: true },
          pagination: { pageSize: 100 }
        });

        const jobs = [];
        const skipped = [];

        for (const supplier of suppliers) {
          // Check lock for each supplier
          const syncId = await syncLockService.acquirePromidataLock(supplier.documentId);
          if (!syncId) {
            skipped.push({ supplierId: supplier.documentId, code: supplier.code, reason: 'already running' });
            continue;
          }

          // Update supplier status
          await strapi.documents('api::supplier.supplier').update({
            documentId: supplier.documentId,
            data: {
              last_sync_status: 'running',
              last_sync_message: `Sync started at ${new Date().toISOString()}`
            }
          });

          const job = await queueService.enqueueSupplierSync(
            supplier.documentId,
            supplier.code,
            Number(supplier.id) // numeric ID
          );
          jobs.push({ jobId: job.id, supplierId: supplier.documentId, code: supplier.code });
        }

        ctx.body = {
          success: true,
          message: `${jobs.length} sync jobs enqueued, ${skipped.length} skipped (already running)`,
          data: { jobs, skipped }
        };
      }
    } catch (error) {
      ctx.badRequest('Sync failed', { details: error.message });
    }
  },

  /**
   * Get all active/running syncs
   */
  async getActiveSyncs(ctx: Context) {
    try {
      const activeSyncs = await syncLockService.getAllActiveSyncs();

      ctx.body = {
        success: true,
        data: {
          promidata: activeSyncs.promidata,
          gemini: activeSyncs.gemini
        }
      };
    } catch (error) {
      ctx.badRequest('Failed to get active syncs', { details: error.message });
    }
  },

  /**
   * Stop a running sync for a specific supplier
   */
  async stopSync(ctx: Context) {
    try {
      const { supplierId } = ctx.params;

      if (!supplierId) {
        ctx.badRequest('Supplier ID is required');
        return;
      }

      // Request stop
      const stopRequested = await syncLockService.requestPromidataStop(supplierId);

      if (!stopRequested) {
        ctx.body = {
          success: false,
          message: 'No sync is currently running for this supplier'
        };
        return;
      }

      // Update supplier status
      await strapi.documents('api::supplier.supplier').update({
        documentId: supplierId,
        data: {
          last_sync_message: `Stop requested at ${new Date().toISOString()}`
        }
      });

      ctx.body = {
        success: true,
        message: 'Stop signal sent. Sync will stop after current batch completes.'
      };
    } catch (error) {
      ctx.badRequest('Failed to stop sync', { details: error.message });
    }
  },

  /**
   * Check sync status for a specific supplier (includes lock status)
   */
  async getSupplierSyncStatus(ctx: Context) {
    try {
      const { supplierId } = ctx.params;

      if (!supplierId) {
        ctx.badRequest('Supplier ID is required');
        return;
      }

      const status = await syncLockService.getPromidataStatus(supplierId);
      const supplier = await strapi.documents('api::supplier.supplier').findOne({
        documentId: supplierId
      });

      ctx.body = {
        success: true,
        data: {
          supplierId,
          supplierCode: supplier?.code,
          isRunning: status.isRunning,
          stopRequested: status.stopRequested,
          lockInfo: status.lockInfo,
          lastSyncStatus: supplier?.last_sync_status,
          lastSyncDate: supplier?.last_sync_date,
          lastSyncMessage: supplier?.last_sync_message
        }
      };
    } catch (error) {
      ctx.badRequest('Failed to get sync status', { details: error.message });
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
        populate: ['categories', 'price_tiers', 'main_image', 'gallery_images', 'variants'],
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
        products: products.map(product => {
          // Extract variant information
          const variants = (product as any).variants || [];
          const availableSizes = variants.length > 0
            ? Array.from(new Set(variants.map((v: any) => v.size).filter(Boolean)))
            : ['One Size'];
          const availableColors = variants.length > 0
            ? Array.from(new Set(variants.map((v: any) => v.color || v.supplier_search_color).filter(Boolean)))
            : [];
          const hexColors = variants.length > 0
            ? Array.from(new Set(variants.map((v: any) => v.hex_color).filter(Boolean)))
            : [];

          return {
            sku: product.sku,
            name: product.name,
            description: product.description,
            short_description: product.short_description,
            available_sizes: availableSizes,
            colors: availableColors,
            hex_colors: hexColors,
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
              total_variants: variants.length,
              last_synced: product.last_synced,
              strapi_id: product.id
            }
          };
        }),
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
  
  // Add brand
  if (product.brand) textParts.push(product.brand);

  // Add variant colors and sizes (if variants are populated)
  if (product.variants && Array.isArray(product.variants)) {
    product.variants.forEach((variant: any) => {
      if (variant.color) textParts.push(variant.color);
      if (variant.supplier_search_color) textParts.push(variant.supplier_search_color);
      if (variant.size) textParts.push(variant.size);
    });
  }

  // Add categories
  if (product.categories && Array.isArray(product.categories)) {
    product.categories.forEach(cat => {
      if (cat.name) textParts.push(cat.name);
    });
  }

  return textParts.filter(Boolean).join(' ');
}