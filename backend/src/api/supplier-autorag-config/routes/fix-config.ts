export default {
  routes: [
    {
      method: 'POST',
      path: '/fix-autorag-config',
      handler: 'supplier-autorag-config.fixConfiguration',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow access without API token authentication
      },
    },
    {
      method: 'POST',
      path: '/test-autorag-sync',
      handler: 'supplier-autorag-config.testAutoRAGSync',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Allow access without API token authentication
      },
    },
    {
      method: 'POST',
      path: '/bulk-sync-a113-autorag',
      handler: 'supplier-autorag-config.bulkSyncA113ToAutoRAG',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
      },
    },
  ],
};