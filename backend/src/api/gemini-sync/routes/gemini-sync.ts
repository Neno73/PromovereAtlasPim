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
  ],
};
