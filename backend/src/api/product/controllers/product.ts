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
      const meilisearchService = strapi.service('api::product.meilisearch');

      // Parse query parameters
      const {
        q = '',                           // Search query
        limit = 20,                       // Results per page
        offset = 0,                       // Pagination offset
        semantic,                         // Semantic ratio: 0-1 (0=keyword, 1=semantic, default=0.5)
        facets = '',                      // Comma-separated facets (e.g., "supplier_code,brand,category")
        sort = '',                        // Comma-separated sort fields (e.g., "price_min:asc,updatedAt:desc")
        // Filters
        supplier_code,
        brand,
        category,
        colors,                           // Comma-separated colors or array
        sizes,                            // Comma-separated sizes or array
        price_min,
        price_max,
        is_active = 'true',
        ids,                              // Comma-separated product IDs for curated selection
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
      // Use STARTS WITH for hierarchical categories (e.g., "FOOD" matches "FOOD/CHOCOLATE")
      if (category) filters.push(`category STARTS WITH "${category}"`);
      if (price_min) filters.push(`price_min >= ${price_min}`);
      if (price_max) filters.push(`price_min <= ${price_max}`);

      // Handle array filters (colors, sizes)
      // These can be comma-separated strings or arrays
      if (colors) {
        const colorList = Array.isArray(colors) ? colors : String(colors).split(',').map(c => c.trim());
        if (colorList.length > 0) {
          // Meilisearch array filter: colors IN ["Red", "Blue"]
          filters.push(`colors IN [${colorList.map(c => `"${c}"`).join(', ')}]`);
        }
      }
      if (sizes) {
        const sizeList = Array.isArray(sizes) ? sizes : String(sizes).split(',').map(s => s.trim());
        if (sizeList.length > 0) {
          filters.push(`sizes IN [${sizeList.map(s => `"${s}"`).join(', ')}]`);
        }
      }

      // Handle product IDs filter (for AI curated selections)
      if (ids) {
        const idList = Array.isArray(ids) ? ids : String(ids).split(',').map(i => i.trim());
        if (idList.length > 0) {
          filters.push(`id IN [${idList.map(i => `"${i}"`).join(', ')}]`);
        }
      }

      // Parse facets (comma-separated list to array)
      const facetsList = facets ? String(facets).split(',').map(f => f.trim()).filter(Boolean) : [];

      // Parse sort (comma-separated list to array)
      const sortList = sort ? String(sort).split(',').map(s => s.trim()).filter(Boolean) : [];

      // Build hybrid search config:
      // - If caller provides semantic ratio, use it explicitly
      // - Otherwise, auto-enable hybrid (0.5) when there's a text query
      const semanticRatio = semantic !== undefined ? parseFloat(String(semantic)) : undefined;
      let hybrid: { semanticRatio: number; embedder: string } | undefined;
      if (semanticRatio !== undefined && !isNaN(semanticRatio)) {
        hybrid = { semanticRatio: Math.max(0, Math.min(1, semanticRatio)), embedder: 'product_search' };
      } else if (q) {
        hybrid = { semanticRatio: 0.5, embedder: 'product_search' };
      }

      // Execute Meilisearch search
      const searchResult = await meilisearchService.searchProducts({
        query: q,
        limit: parseInt(String(limit), 10),
        offset: parseInt(String(offset), 10),
        hybrid,
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
   * Get verification status for multiple products
   * Returns Meilisearch and hash status for batch verification
   */
  async getVerificationStatus(ctx) {
    try {
      const { documentIds } = ctx.request.body;

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return ctx.badRequest('documentIds array is required');
      }

      // Limit to prevent abuse
      if (documentIds.length > 100) {
        return ctx.badRequest('Maximum 100 documentIds allowed per request');
      }

      // Get Meilisearch service
      // @ts-ignore - Custom service not in Strapi types
      const meilisearchService = strapi.service('api::product.meilisearch');

      // Fetch products with needed fields
      const products = await strapi.db.query('api::product.product').findMany({
        where: {
          documentId: { $in: documentIds },
        },
        select: [
          'id',
          'documentId',
          'sku',
          'promidata_hash',
          'last_synced',
        ],
        populate: ['main_image', 'gallery_images', 'variants'],
      });

      // Build status map
      const statusMap: Record<string, {
        inMeilisearch: boolean;
        hashMatches: boolean;
        imageCount: number;
        lastSynced: string | null;
      }> = {};

      // Check Meilisearch status for each product
      for (const product of products) {
        let inMeilisearch = false;

        try {
          // Try to get the document from Meilisearch
          const msDoc = await meilisearchService.index.getDocument(product.documentId);
          inMeilisearch = !!msDoc;
        } catch (error) {
          // Document not found in Meilisearch
          inMeilisearch = false;
        }

        // Count images from main_image, gallery_images, and variants
        let imageCount = 0;
        if (product.main_image) imageCount++;
        if (product.gallery_images?.length) imageCount += product.gallery_images.length;
        if (product.variants?.length) {
          for (const variant of product.variants) {
            if (variant.primary_image) imageCount++;
            if (variant.gallery_images?.length) imageCount += variant.gallery_images.length;
          }
        }

        statusMap[product.documentId] = {
          inMeilisearch,
          hashMatches: !!product.promidata_hash,
          imageCount,
          lastSynced: product.last_synced || null,
        };
      }

      ctx.send({
        success: true,
        data: statusMap,
      });
    } catch (error) {
      strapi.log.error('Failed to get verification status:', error);
      ctx.badRequest('Failed to get verification status', { error: error.message });
    }
  },
}));
