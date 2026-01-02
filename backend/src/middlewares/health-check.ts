/**
 * Health Check Middleware
 *
 * Provides a simple health check endpoint at /_health
 * Used by Docker health checks and monitoring systems
 */

export default (config, { strapi }) => {
  return async (ctx, next) => {
    if (ctx.request.url === '/_health') {
      ctx.body = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      };
      ctx.status = 200;
      return;
    }

    await next();
  };
};
