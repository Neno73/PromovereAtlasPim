/**
 * product controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  /**
   * Get unique brands
   * Efficiently retrieves distinct brand values from products table
   */
  async getBrands(ctx) {
    try {
      // Query database for distinct brands using knex (raw SQL)
      const brands = await strapi.db.connection('products')
        .distinct('brand')
        .whereNotNull('brand')
        .where('brand', '!=', '')
        .orderBy('brand', 'asc');

      // Extract brand values from result
      const brandList = brands
        .map(row => row.brand)
        .filter(Boolean)
        .sort();

      ctx.send({
        data: brandList,
        meta: {
          total: brandList.length
        }
      });
    } catch (error) {
      strapi.log.error('Failed to fetch brands:', error);
      ctx.badRequest('Failed to fetch brands');
    }
  }
}));
