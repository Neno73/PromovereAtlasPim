/**
 * Custom product routes
 * Includes Meilisearch search and verification endpoints
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/products/brands',
      handler: 'product.getBrands',
      config: {
        policies: [], // Public endpoint like other product endpoints
      },
    },
    {
      method: 'GET',
      path: '/products/search',
      handler: 'product.search',
      config: {
        policies: [], // Public endpoint - anyone can search
      },
    },
    {
      method: 'POST',
      path: '/products/verification-status',
      handler: 'product.getVerificationStatus',
      config: {
        policies: [], // Public endpoint for frontend
        description: 'Get verification status (Meilisearch, hash) for multiple products',
      },
    },
  ],
};
