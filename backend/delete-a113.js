#!/usr/bin/env node

// Delete all A113 products script
const { execSync } = require('child_process');

async function deleteA113Products() {
  try {
    console.log('🗑️ Starting A113 product deletion...');
    
    // First, find the A113 supplier ID
    console.log('📋 Finding A113 supplier ID...');
    
    // Use the admin API endpoint directly
    const maxRetries = 50;
    let deleted = 0;
    let batchSize = 100;
    
    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        // Get A113 products in batches
        const cmd = `curl -s -X GET "http://localhost:1337/api/products?filters[supplier][code][\$eq]=A113&pagination[pageSize]=${batchSize}" -H "Content-Type: application/json"`;
        const response = execSync(cmd, { encoding: 'utf8', timeout: 10000 });
        const data = JSON.parse(response);
        
        if (!data.data || data.data.length === 0) {
          console.log(`✅ No more A113 products found. Deleted ${deleted} products total.`);
          break;
        }
        
        console.log(`📦 Found ${data.data.length} A113 products in batch ${retry + 1}`);
        
        // Delete each product
        for (const product of data.data) {
          try {
            const deleteCmd = `curl -s -X DELETE "http://localhost:1337/api/products/${product.id}" -H "Content-Type: application/json"`;
            execSync(deleteCmd, { encoding: 'utf8', timeout: 5000 });
            deleted++;
            console.log(`🗑️ Deleted product ${product.id} (${product.attributes?.sku || 'N/A'}) - Total: ${deleted}`);
          } catch (deleteError) {
            console.error(`❌ Failed to delete product ${product.id}:`, deleteError.message);
          }
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (batchError) {
        console.error(`❌ Batch ${retry + 1} failed:`, batchError.message);
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ A113 product deletion completed. Total deleted: ${deleted}`);
    
  } catch (error) {
    console.error('❌ A113 deletion failed:', error.message);
    process.exit(1);
  }
}

deleteA113Products();