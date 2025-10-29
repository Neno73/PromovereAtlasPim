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
  },
};
