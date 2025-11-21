export default {
  routes: [
    {
      method: 'POST',
      path: '/gemini-sync/init',
      handler: 'gemini-sync.init',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/gemini-sync/trigger-all',
      handler: 'gemini-sync.triggerAll',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
