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
  ],
};