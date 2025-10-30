/**
 * Cron Configuration
 * Scheduled tasks for queue management and supplier synchronization
 *
 * Cron schedule format: https://github.com/node-cron/node-cron#cron-syntax
 */

export default {
  /**
   * Nightly supplier synchronization
   * Runs at 2:00 AM every night
   *
   * Format: minute hour day month weekday
   * '0 2 * * *' = Every day at 02:00
   */
  nightlySupplierSync: {
    task: async ({ strapi }) => {
      strapi.log.info('[CRON] Starting nightly supplier synchronization');

      try {
        const queueService = strapi.service('plugin::queue.queue-service') ||
                           strapi.service('api::queue.queue-service') ||
                           strapi.services['queue.queue-service'];

        if (!queueService) {
          strapi.log.error('[CRON] Queue service not found');
          return;
        }

        // Get all enabled suppliers
        const suppliers = await strapi.entityService.findMany('api::supplier.supplier', {
          filters: { enabled: true },
          fields: ['id', 'code', 'name'],
        });

        strapi.log.info(`[CRON] Found ${suppliers.length} enabled suppliers for sync`);

        // Queue sync jobs for each supplier
        let queued = 0;
        for (const supplier of suppliers) {
          try {
            await queueService.addSupplierSyncJob(supplier.code);
            queued++;
          } catch (error) {
            strapi.log.error(`[CRON] Failed to queue supplier ${supplier.code}:`, error);
          }
        }

        strapi.log.info(`[CRON] Nightly sync complete: Queued ${queued}/${suppliers.length} suppliers`);
      } catch (error) {
        strapi.log.error('[CRON] Nightly supplier sync failed:', error);
      }
    },
    options: {
      rule: '0 2 * * *', // 2:00 AM every day
      tz: 'Europe/Amsterdam', // Adjust to your timezone
    },
  },

  /**
   * Queue cleanup - Remove old completed jobs
   * Runs every 6 hours
   */
  queueCleanup: {
    task: async ({ strapi }) => {
      strapi.log.info('[CRON] Starting queue cleanup');

      try {
        const queueManager = strapi.service('api::queue-manager.queue-manager');

        if (!queueManager) {
          strapi.log.error('[CRON] Queue manager service not found');
          return;
        }

        const queues = ['supplier-sync', 'product-family', 'image-upload'];
        const grace = 24 * 60 * 60 * 1000; // 24 hours

        for (const queueName of queues) {
          try {
            // Clean completed jobs older than 24 hours
            const completedResult = await queueManager.cleanQueue(
              queueName,
              grace,
              'completed'
            );

            // Clean failed jobs older than 24 hours
            const failedResult = await queueManager.cleanQueue(
              queueName,
              grace,
              'failed'
            );

            strapi.log.info(
              `[CRON] Cleaned ${queueName}: ${completedResult.deleted} completed, ${failedResult.deleted} failed`
            );
          } catch (error) {
            strapi.log.error(`[CRON] Failed to clean ${queueName}:`, error);
          }
        }

        strapi.log.info('[CRON] Queue cleanup complete');
      } catch (error) {
        strapi.log.error('[CRON] Queue cleanup failed:', error);
      }
    },
    options: {
      rule: '0 */6 * * *', // Every 6 hours
    },
  },

  /**
   * Weekly full supplier sync
   * Runs every Sunday at 3:00 AM
   *
   * '0 3 * * 0' = Every Sunday at 03:00
   */
  weeklyFullSync: {
    task: async ({ strapi }) => {
      strapi.log.info('[CRON] Starting weekly full supplier synchronization');

      try {
        const queueService = strapi.service('plugin::queue.queue-service') ||
                           strapi.service('api::queue.queue-service') ||
                           strapi.services['queue.queue-service'];

        if (!queueService) {
          strapi.log.error('[CRON] Queue service not found');
          return;
        }

        // Get ALL suppliers (including disabled ones for full sync)
        const suppliers = await strapi.entityService.findMany('api::supplier.supplier', {
          fields: ['id', 'code', 'name', 'enabled'],
        });

        strapi.log.info(`[CRON] Found ${suppliers.length} total suppliers for weekly sync`);

        // Queue sync jobs for all suppliers
        let queued = 0;
        for (const supplier of suppliers) {
          try {
            await queueService.addSupplierSyncJob(supplier.code, {
              priority: 5, // Lower priority for bulk sync
            });
            queued++;
          } catch (error) {
            strapi.log.error(`[CRON] Failed to queue supplier ${supplier.code}:`, error);
          }
        }

        strapi.log.info(`[CRON] Weekly sync complete: Queued ${queued}/${suppliers.length} suppliers`);
      } catch (error) {
        strapi.log.error('[CRON] Weekly supplier sync failed:', error);
      }
    },
    options: {
      rule: '0 3 * * 0', // Every Sunday at 3:00 AM
      tz: 'Europe/Amsterdam',
    },
  },

  /**
   * Health check - Monitor queue health
   * Runs every 15 minutes
   */
  healthCheck: {
    task: async ({ strapi }) => {
      try {
        const queueManager = strapi.service('api::queue-manager.queue-manager');

        if (!queueManager) {
          return; // Silent fail for health check
        }

        const stats = await queueManager.getQueueStats();
        const queues = ['supplier-sync', 'product-family', 'image-upload'];

        // Check for unhealthy queues
        for (const queueName of queues) {
          const queueStats = stats[queueName.replace(/-/g, '')];

          if (!queueStats) continue;

          // Alert if too many failed jobs
          if (queueStats.failed > 50) {
            strapi.log.warn(
              `[HEALTH] Queue ${queueName} has ${queueStats.failed} failed jobs`
            );
          }

          // Alert if queue is paused unexpectedly
          if (queueStats.paused && queueStats.waiting > 0) {
            strapi.log.warn(
              `[HEALTH] Queue ${queueName} is paused with ${queueStats.waiting} waiting jobs`
            );
          }

          // Alert if queue is backing up
          if (queueStats.waiting > 100) {
            strapi.log.warn(
              `[HEALTH] Queue ${queueName} has ${queueStats.waiting} waiting jobs (backlog)`
            );
          }
        }
      } catch (error) {
        // Silent fail for health check to avoid log spam
      }
    },
    options: {
      rule: '*/15 * * * *', // Every 15 minutes
    },
  },
};
