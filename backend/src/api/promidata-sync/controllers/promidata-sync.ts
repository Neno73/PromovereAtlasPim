/**
 * Promidata Sync Controller
 * Handles API endpoints for managing Promidata synchronization
 */

// Define a simple context type
interface Context {
  request: {
    body: any;
  };
  query: any;
  body: any;
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
  }
};