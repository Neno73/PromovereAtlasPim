/**
 * Custom product routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/products/brands',
      handler: 'product.getBrands',
      config: {
        auth: false, // Public endpoint like other product endpoints
      },
    },
  ],
};
