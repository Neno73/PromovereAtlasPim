export default {
  routes: [
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
  ],
};