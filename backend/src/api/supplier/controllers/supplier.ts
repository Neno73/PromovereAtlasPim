/**
 * supplier controller
 */

import { factories } from '@strapi/strapi'
import queueService from '../../../services/queue/queue-service';

export default factories.createCoreController('api::supplier.supplier', ({ strapi }) => ({

  /**
   * Sync a specific supplier's products
   * UPDATED: Now uses BullMQ queue instead of direct sync
   */
  async syncSupplier(ctx) {
    try {
      const { id } = ctx.params; // This is actually the documentId in Strapi 5

      // Get supplier by documentId (Strapi 5)
      const supplier = await strapi.documents('api::supplier.supplier').findOne({
        documentId: id
      });

      if (!supplier) {
        return ctx.notFound('Supplier not found');
      }

      // Enqueue supplier sync job (BullMQ will handle status updates)
      const job = await queueService.enqueueSupplierSync(
        supplier.documentId,
        supplier.code,
        Number(supplier.id), // numeric ID
        true // manual sync
      );

      ctx.body = {
        success: true,
        message: `Sync job enqueued for supplier ${supplier.code}`,
        supplier: supplier.code,
        jobId: job.id,
        note: 'Sync is running in background via BullMQ queue'
      };
    } catch (error) {
      strapi.log.error('Supplier sync failed:', error);
      ctx.throw(500, error.message);
    }
  },

  /**
   * Get sync status for a specific supplier
   */
  async getSyncStatus(ctx) {
    try {
      const { id } = ctx.params; // This is actually the documentId in Strapi 5
      
      const supplier = await strapi.documents('api::supplier.supplier').findOne({
        documentId: id,
        fields: ['id', 'code', 'name', 'last_sync_date', 'last_sync_status', 'last_sync_message', 'auto_import']
      });

      if (!supplier) {
        return ctx.notFound('Supplier not found');
      }

      ctx.body = {
        supplier: {
          id: supplier.id,
          code: supplier.code,
          name: supplier.name,
          lastSyncAt: supplier.last_sync_date,
          syncStatus: supplier.last_sync_status || 'never',
          syncMessage: supplier.last_sync_message,
          autoImport: supplier.auto_import,
          isRunning: supplier.last_sync_status === 'running'
        }
      };
    } catch (error) {
      strapi.log.error('Get sync status error:', error);
      ctx.throw(500, error.message);
    }
  },

  /**
   * Reset sync status for a stuck supplier
   */
  async resetSyncStatus(ctx) {
    try {
      const { id } = ctx.params; // This is actually the documentId in Strapi 5
      
      // Get supplier by documentId (Strapi 5)
      const supplier = await strapi.documents('api::supplier.supplier').findOne({
        documentId: id
      });
      
      if (!supplier) {
        return ctx.notFound('Supplier not found');
      }

      // Reset status using numeric id
      await strapi.entityService.update('api::supplier.supplier', supplier.id, {
        data: {
          last_sync_status: 'completed',
          last_sync_message: `Reset from stuck status at ${new Date().toISOString()}`,
          last_sync_date: new Date()
        }
      });

      ctx.body = {
        success: true,
        message: `Sync status reset for supplier ${supplier.code}`,
        supplier: supplier.code,
        resetAt: new Date().toISOString()
      };
    } catch (error) {
      strapi.log.error('Reset sync status failed:', error);
      ctx.throw(500, error.message);
    }
  },

  /**
   * Quick sync for A23 supplier (for testing)
   * UPDATED: Now uses BullMQ queue
   */
  async syncA23(ctx) {
    try {
      // Find A23 supplier
      const suppliers = await strapi.documents('api::supplier.supplier').findMany({
        filters: { code: 'A23' },
        limit: 1
      });

      if (!suppliers || suppliers.length === 0) {
        return ctx.notFound('A23 supplier not found');
      }

      const supplier = suppliers[0];

      // Enqueue supplier sync job
      const job = await queueService.enqueueSupplierSync(
        supplier.documentId,
        supplier.code,
        Number(supplier.id), // numeric ID
        true // manual sync
      );

      ctx.body = {
        success: true,
        message: `A23 sync job enqueued`,
        supplier: supplier.code,
        jobId: job.id,
        note: 'Sync is running in background via BullMQ queue'
      };
    } catch (error) {
      strapi.log.error('A23 sync failed:', error);
      ctx.throw(500, error.message);
    }
  },

  /**
   * Check what fields were actually collected for A23 products
   */
  async checkA23Products(ctx) {
    try {
      // Find A23 supplier
      const suppliers = await strapi.entityService.findMany('api::supplier.supplier', {
        filters: { code: 'A23' }
      }) as any[];

      if (!suppliers || suppliers.length === 0) {
        return ctx.notFound('A23 supplier not found');
      }

      const supplier = suppliers[0];
      
      // Get latest A23 products
      const products = await strapi.entityService.findMany('api::product.product', {
        filters: {
          supplier: {
            id: supplier.id
          }
        },
        sort: { id: 'desc' },
        limit: 3,
        populate: ['price_tiers', 'variants']
      });
      
      if (!products || products.length === 0) {
        ctx.body = { message: 'No A23 products found' };
        return;
      }

      // Analyze first product
      const product = products[0];
      const variants = (product as any).variants || [];
      const firstVariant = variants.length > 0 ? variants[0] : null;

      ctx.body = {
        message: 'A23 Products Field Check',
        total_products: products.length,
        sample_product: {
          // Product-level fields
          sku: product.sku || 'MISSING',
          supplier_sku: product.supplier_sku || 'MISSING',
          brand: product.brand || 'MISSING',
          country_of_origin: product.country_of_origin || 'MISSING',
          customs_tariff_number: product.customs_tariff_number || 'MISSING',
          price_tiers_count: (product as any).price_tiers ? (product as any).price_tiers.length : 0,
          name_languages: product.name ? Object.keys(product.name) : [],
          description_languages: product.description ? Object.keys(product.description) : [],
          material_languages: product.material ? Object.keys(product.material) : [],
          has_promidata_hash: !!product.promidata_hash,
          last_synced: product.last_synced || 'MISSING',
          // Variant-level fields (from first variant if available)
          total_variants: variants.length,
          variant_info: firstVariant ? {
            supplier_main_category: firstVariant.supplier_main_category || 'MISSING',
            supplier_search_color: firstVariant.supplier_search_color || 'MISSING',
            supplier_color_code: firstVariant.supplier_color_code || 'MISSING',
            hex_color: firstVariant.hex_color || 'MISSING',
            weight: firstVariant.weight || 'MISSING',
            dimensions: {
              length: firstVariant.dimensions_length || 'MISSING',
              width: firstVariant.dimensions_width || 'MISSING',
              height: firstVariant.dimensions_height || 'MISSING'
            }
          } : 'No variants available'
        },
        all_product_skus: products.map(p => p.sku),
        field_extraction_summary: {
          basic_fields: '✅ Collected',
          multilingual_content: product.name && Object.keys(product.name).length > 0 ? '✅ Collected' : '❌ Missing',
          brand_info: product.brand ? '✅ Collected' : '❌ Missing',
          color_info: firstVariant && (firstVariant.supplier_search_color || firstVariant.supplier_color_code) ? '✅ Collected' : '❌ Missing',
          pricing: (product as any).price_tiers && (product as any).price_tiers.length > 0 ? '✅ Collected' : '❌ Missing',
          geographic: product.country_of_origin ? '✅ Collected' : '❌ Missing',
          variants: variants.length > 0 ? '✅ Collected' : '❌ Missing'
        }
      };
    } catch (error) {
      strapi.log.error('Product check failed:', error);
      ctx.throw(500, error.message);
    }
  }
}));
