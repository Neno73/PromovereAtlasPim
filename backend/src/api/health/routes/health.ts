/**
 * Health Check Routes
 *
 * Public route for health monitoring
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: 'health.index',
      config: {
        auth: false,
      },
    },
  ],
};
