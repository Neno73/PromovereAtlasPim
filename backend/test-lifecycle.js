/**
 * Test script to manually trigger AutoRAG lifecycle hook
 */

const strapi = require('./config/database');

async function testLifecycleHook() {
  try {
    console.log('🧪 Testing AutoRAG lifecycle hook...');
    
    // Import the lifecycle function directly
    const autoragService = require('./src/services/autorag').default;
    console.log('✅ AutoRAG service loaded successfully');
    
    // Get a sample product
    const product = {
      sku: 'A113-TEST-001',
      documentId: 'test-doc-id',
      is_active: true,
      supplier: {
        documentId: 'supplier-doc-id',
        code: 'A113'
      }
    };
    
    // Simulate the lifecycle hook trigger
    console.log('🔄 Simulating product update lifecycle hook...');
    
    // Get supplier with AutoRAG config
    const suppliers = await strapi.entityService.findMany('api::supplier.supplier', {
      filters: { code: 'A113' },
      populate: ['autorag_config']
    });
    
    if (suppliers.length === 0) {
      console.log('❌ No A113 supplier found');
      return;
    }
    
    const supplier = suppliers[0];
    console.log(`📍 Found supplier: ${supplier.code} - ${supplier.name}`);
    console.log(`🔧 AutoRAG config: ${supplier.autorag_config ? 'Found' : 'Missing'}`);
    
    if (supplier.autorag_config) {
      console.log('Config details:', {
        autorag_id: supplier.autorag_config.autorag_id,
        status: supplier.autorag_config.status,
        sync_frequency: supplier.autorag_config.sync_frequency
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testLifecycleHook();