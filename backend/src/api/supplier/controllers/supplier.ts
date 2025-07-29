/**
 * supplier controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::supplier.supplier', ({ strapi }) => ({
  
  /**
   * Sync a specific supplier's products
   */
  async syncSupplier(ctx) {
    try {
      const { id } = ctx.params;
      
      // Get supplier
      const supplier = await strapi.entityService.findOne('api::supplier.supplier', id);
      if (!supplier) {
        return ctx.notFound('Supplier not found');
      }

      // Get or create sync configuration
      const syncConfigs = await strapi.entityService.findMany('api::sync-configuration.sync-configuration', {
        filters: { supplier: id },
      });
      let syncConfig = syncConfigs.length > 0 ? syncConfigs[0] : null;

      if (!syncConfig) {
        syncConfig = await strapi.entityService.create('api::sync-configuration.sync-configuration', {
          data: {
            supplier: id,
            enabled: supplier.auto_import,
            sync_status: 'running',
            sync_log: 'Sync in progress...'
          }
        });
      } else {
        await strapi.entityService.update('api::sync-configuration.sync-configuration', syncConfig.id, {
          data: {
            sync_status: 'running',
            sync_log: 'Sync in progress...'
          }
        });
      }

      try {
        // Trigger sync
        const result = await strapi.service('api::promidata-sync.promidata-sync').syncSupplier(supplier);
        
        // Update success status
        const totalProcessed = (result.imported || 0) + (result.updated || 0);
        const efficiency = result.efficiency || '0%';
        await strapi.entityService.update('api::sync-configuration.sync-configuration', syncConfig.id, {
          data: {
            last_sync: new Date(),
            sync_status: 'completed',
            sync_log: `Processed ${totalProcessed}, skipped ${result.skipped || 0} (${efficiency} efficiency)`,
            products_processed: totalProcessed,
            products_created: result.imported,
            products_updated: result.updated,
            sync_error: null
          }
        });

        ctx.body = {
          success: true,
          message: 'Sync completed successfully',
          supplier: supplier.code,
          ...result
        };
      } catch (syncError) {
        // Update failure status
        await strapi.entityService.update('api::sync-configuration.sync-configuration', syncConfig.id, {
          data: {
            last_sync: new Date(),
            sync_status: 'failed',
            sync_error: syncError.message
          }
        });
        throw syncError;
      }
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
      const { id } = ctx.params;
      
      const supplier = await strapi.entityService.findOne('api::supplier.supplier', id, {
        populate: {
          sync_config: true,
        },
      }) as any;

      if (!supplier) {
        return ctx.notFound('Supplier not found');
      }

      const syncConfig = supplier.sync_config;

      ctx.body = {
        supplier: {
          id: supplier.id,
          code: supplier.code,
          name: supplier.name,
          lastSyncAt: syncConfig ? syncConfig.last_sync : null,
          syncStatus: syncConfig ? syncConfig.sync_status : 'never',
          syncMessage: syncConfig ? syncConfig.sync_log : null,
          autoImport: supplier.auto_import,
          isRunning: syncConfig ? syncConfig.sync_status === 'running' : false
        }
      };
    } catch (error) {
      strapi.log.error('Get sync status error:', error);
      ctx.throw(500, error.message);
    }
  },

}));
