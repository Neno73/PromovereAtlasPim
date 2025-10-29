/**
 * Quick Win #3: Health Check Routes
 * Public endpoints for monitoring system health
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: 'health.check',
      config: {
        auth: false, // Public endpoint - no authentication required
        policies: []
      }
    },
    {
      method: 'GET',
      path: '/health/alive',
      handler: 'health.alive',
      config: {
        auth: false,
        policies: []
      }
    },
    {
      method: 'GET',
      path: '/health/ready',
      handler: 'health.ready',
      config: {
        auth: false,
        policies: []
      }
    }
  ]
};
