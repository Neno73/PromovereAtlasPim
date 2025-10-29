/**
 * Quick Win #3: Health Check Controller
 * Monitors system health for database, R2, and Promidata API
 */

export default {
  /**
   * Main health check endpoint
   * Returns 200 if healthy, 503 if unhealthy
   */
  async check(ctx) {
    const startTime = Date.now();

    // Run all health checks in parallel
    const [database, r2, promidataApi] = await Promise.all([
      this.checkDatabase(),
      this.checkR2(),
      this.checkPromidataAPI()
    ]);

    const allHealthy = [database, r2, promidataApi].every(check => check.healthy);
    const totalTime = Date.now() - startTime;

    ctx.status = allHealthy ? 200 : 503;
    ctx.send({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${totalTime}ms`,
      checks: {
        database,
        r2Storage: r2,
        promidataApi
      },
      version: strapi.config.info.strapi || 'unknown'
    });
  },

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    try {
      const start = Date.now();

      // Simple query to verify database is responding
      await strapi.db.connection.raw('SELECT 1');

      const responseTime = Date.now() - start;

      // Get database client info
      const client = strapi.db.config.connection.client;

      return {
        name: 'database',
        healthy: true,
        responseTime: `${responseTime}ms`,
        details: {
          client,
          status: 'connected'
        }
      };
    } catch (error) {
      return {
        name: 'database',
        healthy: false,
        error: error.message,
        details: {
          status: 'disconnected'
        }
      };
    }
  },

  /**
   * Check R2 storage connectivity
   */
  async checkR2() {
    try {
      const start = Date.now();

      // Check if R2 provider is configured
      const uploadProvider = strapi.plugin('upload')?.provider;

      if (!uploadProvider) {
        throw new Error('Upload provider not configured');
      }

      // Check environment variables
      const r2Configured = !!(
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME
      );

      if (!r2Configured) {
        throw new Error('R2 environment variables not configured');
      }

      const responseTime = Date.now() - start;

      return {
        name: 'r2_storage',
        healthy: true,
        responseTime: `${responseTime}ms`,
        details: {
          bucket: process.env.R2_BUCKET_NAME,
          status: 'configured'
        }
      };
    } catch (error) {
      return {
        name: 'r2_storage',
        healthy: false,
        error: error.message,
        details: {
          status: 'not_configured'
        }
      };
    }
  },

  /**
   * Check Promidata API connectivity
   */
  async checkPromidataAPI() {
    try {
      const start = Date.now();

      // Use HEAD request to check connectivity without downloading data
      const promidataUrl = 'https://promidatabase.s3.eu-central-1.amazonaws.com/Profiles/Live/849c892e-b443-4f49-be3a-61a351cbdd23/Import/Import.txt';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(promidataUrl, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - start;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        name: 'promidata_api',
        healthy: true,
        responseTime: `${responseTime}ms`,
        details: {
          status: response.status,
          statusText: response.statusText
        }
      };
    } catch (error) {
      return {
        name: 'promidata_api',
        healthy: false,
        error: error.message,
        details: {
          status: 'unreachable'
        }
      };
    }
  },

  /**
   * Simple liveness probe
   * Always returns 200 - used by orchestrators to know the service is running
   */
  async alive(ctx) {
    ctx.send({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  },

  /**
   * Readiness probe
   * Returns 200 only when service is ready to handle requests
   */
  async ready(ctx) {
    try {
      // Check if Strapi is fully loaded
      if (!strapi.isLoaded) {
        throw new Error('Strapi not fully loaded');
      }

      // Quick database check
      await strapi.db.connection.raw('SELECT 1');

      ctx.send({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      ctx.status = 503;
      ctx.send({
        status: 'not_ready',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
};
