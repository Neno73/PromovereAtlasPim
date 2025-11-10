import queueService from './services/queue/queue-service';
import workerManager from './services/queue/worker-manager';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { KoaAdapter } from '@bull-board/koa';
import bullBoardAuth from './middlewares/bull-board-auth';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {
    // Note: strapi.app is not available here
    // Middleware registration moved to bootstrap()
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Register Bull Board authentication middleware early
    // This protects /admin/queues routes with admin JWT verification
    // Note: Use strapi.server.app instead of strapi.app
    if (strapi.server && strapi.server.app) {
      strapi.server.app.use(bullBoardAuth({}, { strapi }));
    }

    strapi.log.info('🚀 Bootstrapping application to set public permissions...');
    try {
      // Strapi 5: Use findMany with filters instead of findOne with where
      const publicRoles = await strapi.query('plugin::users-permissions.role').findMany({
        filters: { type: 'public' },
        limit: 1,
      });

      const publicRole = publicRoles?.[0];

      if (!publicRole) {
        strapi.log.error('❌ Bootstrap Error: Could not find the public role.');
        return;
      }

      strapi.log.info(`Found public role with ID: ${publicRole.id}. Proceeding to set permissions.`);

      const permissionsToSet = [
        'api::product.product.find',
        'api::product.product.findOne',
        'api::product.product.getBrands',
        'api::product.product.search',
        'api::product-variant.product-variant.find',
        'api::product-variant.product-variant.findOne',
        'api::category.category.find',
        'api::category.category.findOne',
        'api::supplier.supplier.find',
        'api::supplier.supplier.findOne',
      ];

      for (const action of permissionsToSet) {
        strapi.log.info(`- Processing permission: ${action}`);
        try {
          // Strapi 5: Use findMany with filters instead of findOne with where
          const permissions = await strapi.query('plugin::users-permissions.permission').findMany({
            filters: { action, role: publicRole.id },
            limit: 1,
          });

          const permission = permissions?.[0];

          if (permission) {
            if (!permission.enabled) {
              strapi.log.info(`  Permission found, enabling...`);
              await strapi.query('plugin::users-permissions.permission').update({
                where: { id: permission.id },
                data: { enabled: true },
              });
              strapi.log.info(`  ✅ Permission enabled.`);
            } else {
              strapi.log.info(`  Permission was already enabled.`);
            }
          } else {
            strapi.log.info(`  Permission not found, creating...`);
            await strapi.query('plugin::users-permissions.permission').create({
              data: { action, role: publicRole.id, enabled: true },
            });
            strapi.log.info(`  ✅ Permission created and enabled.`);
          }
        } catch (err) {
          strapi.log.error(`  ❌ Error processing permission ${action}:`, err.message);
        }
      }

      strapi.log.info('✅ Bootstrap finished setting public API permissions.');
    } catch (error) {
      strapi.log.error('❌ An error occurred during the bootstrap process:', error);
    }

    // Health check endpoint is now at /api/health (see src/api/health/)

    // Discover and sync suppliers from Promidata
    // Only runs if suppliers are missing (smart check)
    strapi.log.info('\n🔍 Checking supplier database...');
    try {
      const supplierSyncService = await import('./services/promidata/sync/supplier-sync-service');
      const missingSuppliers = await supplierSyncService.default.getMissingSuppliers();

      if (missingSuppliers.length > 0) {
        strapi.log.info(`📊 Found ${missingSuppliers.length} new suppliers in Promidata, syncing...`);
        const result = await supplierSyncService.default.discoverAndSyncSuppliers();
        strapi.log.info(`✅ Supplier discovery complete: ${result.created} created, ${result.updated} updated from ${result.discovered} discovered`);
      } else {
        const allSuppliers = await strapi.documents('api::supplier.supplier').findMany({
          pagination: { page: 1, pageSize: 1 },
        });
        strapi.log.info(`✅ Supplier database is up-to-date (${allSuppliers.length > 0 ? 'suppliers exist' : 'no suppliers in Promidata'})`);
      }
    } catch (error) {
      strapi.log.error('❌ Error during supplier discovery:', error.message);
      strapi.log.warn('⚠️  You can manually sync suppliers later via the admin panel');
    }

    // Initialize BullMQ queue service and workers
    // Use setImmediate to ensure Strapi is fully initialized before starting workers
    strapi.log.info('\n🚀 Scheduling BullMQ queue service and worker initialization...');
    setImmediate(async () => {
      try {
        // Verify Strapi is ready before starting workers
        if (!strapi.db) {
          throw new Error('Strapi database not initialized');
        }

        await queueService.initialize();
        await workerManager.start();
        strapi.log.info('✅ Queue service and workers initialized successfully');

        // Initialize Bull Board for queue monitoring
        try {
          const serverAdapter = new KoaAdapter();
          serverAdapter.setBasePath('/admin/queues');

          const queues = queueService.getQueuesForBullBoard();

          createBullBoard({
            queues: queues.map(queue => new BullMQAdapter(queue)),
            serverAdapter,
          });

          // Register Bull Board routes with Koa
          if (strapi.server && strapi.server.app) {
            strapi.server.app.use(serverAdapter.registerPlugin());
            strapi.log.info('✅ Bull Board UI mounted at /admin/queues');
            strapi.log.info('   Access the dashboard: http://localhost:1337/admin/queues');
            strapi.log.info('   (Requires admin JWT token in Authorization header)');
          } else {
            throw new Error('Strapi server not available for Bull Board registration');
          }
        } catch (error) {
          strapi.log.error('❌ Failed to initialize Bull Board:', error);
          // Don't throw - Bull Board is optional monitoring tool
        }
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
    strapi.log.info('🛑 Shutting down application...');

    try {
      // Stop workers
      await workerManager.stop();
      // Close queues
      await queueService.close();
      strapi.log.info('✅ Queue service and workers shut down successfully');
    } catch (error) {
      strapi.log.error('❌ Error during shutdown:', error);
    }
  },
};
