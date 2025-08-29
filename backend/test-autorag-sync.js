const { createStrapi } = require('@strapi/strapi');

async function testAutoRAGSync() {
  let strapi = null;
  
  try {
    console.log('🔄 Starting Strapi instance...');
    
    // Create a minimal Strapi instance
    strapi = await createStrapi();
    await strapi.load();
    
    console.log('✅ Strapi loaded successfully');
    
    // Get the AutoRAG service
    const autoragService = require('./src/services/autorag').default;
    console.log('📦 AutoRAG service loaded');
    
    // Test product data
    const testProduct = {
      sku: 'TEST-123',
      supplier_code: 'A113',
      supplier_name: 'Malfini',
      name: { en: 'Test Product' },
      description: { en: 'Test description for AutoRAG sync' },
      category_hierarchy: 'Test Category',
      variant_type: 'single',
      industry_context: 'Perfect for promotional campaigns, corporate gifts, and marketing events.'
    };
    
    // Test AutoRAG config
    const testConfig = {
      autorag_id: 'malfini-rag',
      cloudflare_account_id: 'a7c64d1d58510810b3c8f96d3631c8c9',
      api_endpoint: 'https://a7c64d1d58510810b3c8f96d3631c8c9.r2.cloudflarestorage.com/malfini'
    };
    
    console.log('🔧 Testing R2 upload...');
    console.log('Config:', testConfig);
    console.log('Product:', testProduct);
    
    // Test the upload
    const result = await autoragService.uploadProduct(testConfig, testProduct);
    
    if (result) {
      console.log('✅ Product uploaded successfully to R2 bucket!');
    } else {
      console.log('❌ Product upload failed');
    }
    
    console.log('🔍 Testing bucket extraction...');
    const extractedBucket = autoragService.extractBucketFromConfig ? 
      autoragService.extractBucketFromConfig(testConfig) : 
      'Method not available';
    console.log('Extracted bucket:', extractedBucket);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (strapi) {
      console.log('🔄 Cleaning up...');
      await strapi.destroy();
    }
    console.log('🏁 Script completed');
    process.exit(0);
  }
}

// Run the test
testAutoRAGSync();