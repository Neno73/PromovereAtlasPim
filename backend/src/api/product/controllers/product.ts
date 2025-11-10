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
  },

  /**
   * Search products using Meilisearch
   * Public endpoint with typo tolerance and faceted filtering
   */
  async search(ctx) {
    try {
      // Get Meilisearch service
      // @ts-ignore - Custom service not in Strapi types
      const meilisearchService = strapi.service('meilisearch');

      // Parse query parameters
      const {
        q = '',                           // Search query
        limit = 20,                       // Results per page
        offset = 0,                       // Pagination offset
        facets = '',                      // Comma-separated facets (e.g., "supplier_code,brand,category")
        sort = '',                        // Comma-separated sort fields (e.g., "price_min:asc,updatedAt:desc")
        // Filters
        supplier_code,
        brand,
        category,
        price_min,
        price_max,
        is_active = 'true',
      } = ctx.query;

      // Build filters array
      const filters: string[] = [];

      // Parse is_active (defaults to true - only show active products)
      if (is_active === 'true' || is_active === true) {
        filters.push('is_active = true');
      } else if (is_active === 'false' || is_active === false) {
        filters.push('is_active = false');
      }

      // Add filters
      if (supplier_code) filters.push(`supplier_code = "${supplier_code}"`);
      if (brand) filters.push(`brand = "${brand}"`);
      if (category) filters.push(`category = "${category}"`);
      if (price_min) filters.push(`price_min >= ${price_min}`);
      if (price_max) filters.push(`price_min <= ${price_max}`);

      // Parse facets (comma-separated list to array)
      const facetsList = facets ? String(facets).split(',').map(f => f.trim()).filter(Boolean) : [];

      // Parse sort (comma-separated list to array)
      const sortList = sort ? String(sort).split(',').map(s => s.trim()).filter(Boolean) : [];

      // Execute Meilisearch search
      const searchResult = await meilisearchService.searchProducts({
        query: q,
        limit: parseInt(String(limit), 10),
        offset: parseInt(String(offset), 10),
        filters,
        facets: facetsList,
        sort: sortList,
      });

      // Return in Strapi-compatible format
      ctx.send({
        data: searchResult.hits,
        meta: {
          pagination: {
            page: Math.floor(searchResult.offset / searchResult.limit) + 1,
            pageSize: searchResult.limit,
            pageCount: Math.ceil(searchResult.estimatedTotalHits / searchResult.limit),
            total: searchResult.estimatedTotalHits,
          },
          search: {
            query: searchResult.query,
            processingTimeMs: searchResult.processingTimeMs,
          },
          facets: searchResult.facetDistribution,
        },
      });
    } catch (error) {
      strapi.log.error('Meilisearch search failed:', error);
      ctx.badRequest('Search failed', { error: error.message });
    }
  },

  /**
   * Reindex all products to Meilisearch
   * Admin-only endpoint for bulk reindexing
   */
  async reindex(ctx) {
    try {
      // Get Meilisearch service
      // @ts-ignore - Custom service not in Strapi types
      const meilisearchService = strapi.service('meilisearch');

      // Initialize Meilisearch index (creates if doesn't exist, configures settings)
      await meilisearchService.initializeIndex();

      // Fetch all products with relations
      const products = await strapi.db.query('api::product.product').findMany({
        populate: [
          'supplier',
          'categories',
          'variants',
          'main_image',
          'gallery_images',
          'price_tiers',
          'dimensions',
        ],
        where: {
          is_active: true, // Only index active products
        },
      });

      strapi.log.info(`Starting reindex of ${products.length} products...`);

      // Bulk index products
      const stats = await meilisearchService.bulkAddOrUpdateDocuments(products);

      strapi.log.info(`Reindex complete: ${stats.indexedDocuments}/${stats.totalDocuments} indexed`);

      ctx.send({
        success: true,
        data: {
          totalDocuments: stats.totalDocuments,
          indexedDocuments: stats.indexedDocuments,
          failedDocuments: stats.failedDocuments,
          processingTimeMs: stats.processingTimeMs,
          errors: stats.errors,
        },
        message: `Successfully reindexed ${stats.indexedDocuments} products`,
      });
    } catch (error) {
      strapi.log.error('Reindex failed:', error);
      ctx.badRequest('Reindex failed', { error: error.message });
    }
  },
}));
