#!/usr/bin/env node

// Direct Strapi deletion script
const strapi = require('@strapi/strapi');

async function deleteA113Products() {
  try {
    console.log('🚀 Starting Strapi...');
    
    // Initialize Strapi
    const app = await strapi({
      dir: process.cwd(),
      autoReload: false,
      serveAdminPanel: false
    }).start();

    console.log('🗑️ Starting A113 product deletion...');
    
    // Find A113 supplier
    const supplier = await strapi.documents('api::supplier.supplier').findMany({
      filters: { code: 'A113' },
      limit: 1
    });
    
    if (!supplier.length) {
      console.log('❌ A113 supplier not found');
      await strapi.stop();
      return;
    }
    
    const supplierId = supplier[0].id;
    console.log(`📋 Found A113 supplier ID: ${supplierId}`);
    
    // Get all A113 products
    let deleted = 0;
    let page = 1;
    const pageSize = 100;
    
    while (true) {
      const products = await strapi.documents('api::product.product').findMany({
        filters: { 
          supplier: { 
            id: supplierId 
          }
        },
        pagination: {
          page: page,
          pageSize: pageSize
        }
      });
      
      if (!products.length) {
        console.log(`✅ No more A113 products found. Deleted ${deleted} products total.`);
        break;
      }
      
      console.log(`📦 Found ${products.length} A113 products in page ${page}`);
      
      // Delete each product
      for (const product of products) {
        try {
          await strapi.documents('api::product.product').delete({
            documentId: product.documentId
          });
          deleted++;
          console.log(`🗑️ Deleted product ${product.documentId} (${product.sku || 'N/A'}) - Total: ${deleted}`);
        } catch (deleteError) {
          console.error(`❌ Failed to delete product ${product.documentId}:`, deleteError.message);
        }
      }
      
      page++;
    }
    
    console.log(`✅ A113 product deletion completed. Total deleted: ${deleted}`);
    
    // Stop Strapi
    await strapi.stop();
    
  } catch (error) {
    console.error('❌ A113 deletion failed:', error.message);
    process.exit(1);
  }
}

deleteA113Products();