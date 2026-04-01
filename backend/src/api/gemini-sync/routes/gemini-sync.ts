/**
 * Gemini Sync Routes
 * Routes for managing Gemini RAG synchronization
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/gemini-sync/init',
      handler: 'gemini-sync.init',
      config: {
        policies: [],
        middlewares: [],
        description: 'Initialize Gemini FileSearchStore',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'POST',
      path: '/gemini-sync/trigger-all',
      handler: 'gemini-sync.triggerAll',
      config: {
        policies: [],
        middlewares: [],
        description: 'Trigger sync of all active products to Gemini',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'GET',
      path: '/gemini-sync/stats',
      handler: 'gemini-sync.stats',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get Gemini File Search statistics',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'POST',
      path: '/gemini-sync/trigger-by-supplier',
      handler: 'gemini-sync.triggerBySupplier',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow access from Admin Panel
        description: 'Trigger sync of all products from a specific supplier to Gemini',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'GET',
      path: '/gemini-sync/active',
      handler: 'gemini-sync.getActiveGeminiSyncs',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow public access for admin UI polling
        description: 'Get all active Gemini syncs',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'GET',
      path: '/gemini-sync/status/:supplierCode',
      handler: 'gemini-sync.getGeminiSyncStatus',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow public access for admin UI polling
        description: 'Get Gemini sync status for a supplier',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'POST',
      path: '/gemini-sync/stop/:supplierCode',
      handler: 'gemini-sync.stopGeminiSync',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow access from Admin Panel
        description: 'Stop a running Gemini sync',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'GET',
      path: '/gemini-sync/store-info',
      handler: 'gemini-sync.getStoreInfo',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow access from Admin Panel
        description: 'Get FileSearchStore details and health status',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'POST',
      path: '/gemini-sync/test-search',
      handler: 'gemini-sync.testSearch',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow access from Admin Panel
        description: 'Test semantic search against FileSearchStore',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'GET',
      path: '/gemini-sync/stores',
      handler: 'gemini-sync.listStores',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
        description: 'List all FileSearchStores',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'POST',
      path: '/gemini-sync/stores/create',
      handler: 'gemini-sync.createStore',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
        description: 'Create a new FileSearchStore',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'DELETE',
      path: '/gemini-sync/stores/:storeId',
      handler: 'gemini-sync.deleteStore',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
        description: 'Delete a FileSearchStore',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'GET',
      path: '/gemini-sync/detailed-stats',
      handler: 'gemini-sync.getDetailedStats',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
        description: 'Get detailed statistics with active/pending/failed counts',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'GET',
      path: '/gemini-sync/search-history',
      handler: 'gemini-sync.getSearchHistory',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
        description: 'Get recent search history',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'POST',
      path: '/gemini-sync/verify-product/:documentId',
      handler: 'gemini-sync.verifyProduct',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
        description: 'Verify if a product exists in Gemini FileSearchStore via semantic search',
        tags: ['Gemini Sync'],
      },
    },
    {
      method: 'POST',
      path: '/gemini-sync/reconcile',
      handler: 'gemini-sync.reconcile',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
        description: 'Run reconciliation: compare tracking vs actual FileSearchStore',
        tags: ['Gemini Sync'],
      },
    },
  ],
};
