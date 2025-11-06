/**
 * Health Check Controller
 *
 * Provides a simple health check endpoint for monitoring
 */

export default {
  /**
   * Health check endpoint
   * Returns 200 OK with system status
   */
  index(ctx) {
    ctx.status = 200;
    ctx.body = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
    };
  },
};
