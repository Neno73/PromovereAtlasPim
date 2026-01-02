/**
 * Promidata Sync Routes
 * Defines API routes for Promidata synchronization
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/promidata-sync/start',
      handler: 'promidata-sync.startSync',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow access from Admin Panel
      },
    },
    {
      method: 'GET',
      path: '/promidata-sync/active',
      handler: 'promidata-sync.getActiveSyncs',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow public access for admin UI polling
      },
    },
    {
      method: 'POST',
      path: '/promidata-sync/stop/:supplierId',
      handler: 'promidata-sync.stopSync',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow access from Admin Panel
      },
    },
    {
      method: 'GET',
      path: '/promidata-sync/status/:supplierId',
      handler: 'promidata-sync.getSupplierSyncStatus',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow public access for admin UI polling
      },
    },
    {
      method: 'GET',
      path: '/promidata-sync/status',
      handler: 'promidata-sync.getSyncStatus',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/promidata-sync/history',
      handler: 'promidata-sync.getSyncHistory',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/promidata-sync/import-categories',
      handler: 'promidata-sync.importCategories',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow access without API token authentication
      },
    },
    {
      method: 'GET',
      path: '/promidata-sync/test-connection',
      handler: 'promidata-sync.testConnection',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/promidata-sync/export/:supplierId',
      handler: 'promidata-sync.exportSupplierProducts',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow access without API token authentication
      },
    },
    /*
    // COMMENTED OUT - AutoRAG not in use
    {
      method: 'POST',
      path: '/promidata-sync/autorag/sync/:supplierId',
      handler: 'promidata-sync.syncSupplierToAutoRAG',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    */
  ],
};