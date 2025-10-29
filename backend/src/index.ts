import queueService from './services/queue/queue-service';
import workerManager from './services/queue/worker-manager';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    console.log('🚀 Bootstrapping application to set public permissions...');
    try {
      const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
      });

      if (!publicRole) {
        console.error('❌ Bootstrap Error: Could not find the public role.');
        return;
      }

      console.log(`Found public role with ID: ${publicRole.id}. Proceeding to set permissions.`);

      const permissionsToSet = [
        'api::product.product.find',
        'api::product.product.findOne',
        'api::product-variant.product-variant.find',
        'api::product-variant.product-variant.findOne',
        'api::category.category.find',
        'api::category.category.findOne',
        'api::supplier.supplier.find',
        'api::supplier.supplier.findOne',
      ];

      for (const action of permissionsToSet) {
        console.log(`- Processing permission: ${action}`);
        try {
          const permission = await strapi.query('plugin::users-permissions.permission').findOne({
            where: { action, role: publicRole.id },
          });

          if (permission) {
            if (!permission.enabled) {
              console.log(`  Permission found, enabling...`);
              await strapi.query('plugin::users-permissions.permission').update({
                where: { id: permission.id },
                data: { enabled: true },
              });
              console.log(`  ✅ Permission enabled.`);
            } else {
              console.log(`  Permission was already enabled.`);
            }
          } else {
            console.log(`  Permission not found, creating...`);
            await strapi.query('plugin::users-permissions.permission').create({
              data: { action, role: publicRole.id, enabled: true },
            });
            console.log(`  ✅ Permission created and enabled.`);
          }
        } catch (err) {
          console.error(`  ❌ Error processing permission ${action}:`, err.message);
        }
      }

      console.log('✅ Bootstrap finished setting public API permissions.');
    } catch (error) {
      console.error('❌ An error occurred during the bootstrap process:', error);
    }

    // Initialize BullMQ queue service and workers
    // Use setImmediate to ensure Strapi is fully initialized before starting workers
    console.log('\n🚀 Scheduling BullMQ queue service and worker initialization...');
    setImmediate(async () => {
      try {
        // Verify Strapi is ready before starting workers
        if (!strapi.db) {
          throw new Error('Strapi database not initialized');
        }

        await queueService.initialize();
        await workerManager.start();
        strapi.log.info('✅ Queue service and workers initialized successfully');
      } catch (error) {
        strapi.log.error('❌ Failed to initialize queue service or workers:', error);
        // Don't throw - allow app to continue without workers if Redis unavailable
      }
    });
  },

  /**
   * An asynchronous destroy function that runs before
   * your application is destroyed.
   *
   * This gives you an opportunity to gracefully shut down services.
   */
  async destroy({ strapi }) {
    console.log('🛑 Shutting down application...');

    try {
      // Stop workers
      await workerManager.stop();
      // Close queues
      await queueService.close();
      console.log('✅ Queue service and workers shut down successfully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  },
};
