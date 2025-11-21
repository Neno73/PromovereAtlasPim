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
  ],
};
