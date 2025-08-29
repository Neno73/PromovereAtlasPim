const strapi = require('./dist/index.js');

async function fixAutoRAGConfig() {
  try {
    console.log('🔄 Starting Strapi to fix AutoRAG configuration...');
    
    // Find Malfini supplier autorag config
    const configs = await strapi.entityService.findMany('api::supplier-autorag-config.supplier-autorag-config', {
      filters: { 
        autorag_id: 'malfini-rag'
      },
      populate: ['supplier']
    });
    
    if (!configs || configs.length === 0) {
      console.log('❌ Malfini AutoRAG config not found');
      
      // Find Malfini supplier to create new config
      const suppliers = await strapi.entityService.findMany('api::supplier.supplier', {
        filters: { code: 'A113' }
      });
      
      if (suppliers && suppliers.length > 0) {
        console.log('📍 Creating new AutoRAG config for Malfini...');
        
        const newConfig = await strapi.entityService.create('api::supplier-autorag-config.supplier-autorag-config', {
          data: {
            supplier: suppliers[0].id,
            autorag_id: 'malfini-rag',
            cloudflare_account_id: 'a7c64d1d58510810b3c8f96d3631c8c9',
            api_endpoint: 'https://api.cloudflare.com/client/v4/accounts/a7c64d1d58510810b3c8f96d3631c8c9/ai/run/@cf/jina-ai/jina-embeddings-v2-base-en',
            status: 'active',
            sync_frequency: 'real-time',
            company_context: 'Malfini promotional products supplier'
          }
        });
        
        console.log('✅ Successfully created AutoRAG config:', newConfig.id);
      } else {
        console.log('❌ Malfini supplier not found');
      }
      
      return;
    }

    const config = configs[0];
    console.log(`📍 Found AutoRAG config: ${config.id} for supplier ${config.supplier?.code || 'unknown'}`);
    console.log(`📅 Current API endpoint: ${config.api_endpoint}`);
    console.log(`📅 Current status: ${config.status}`);
    
    // Update the configuration
    const updatedConfig = await strapi.entityService.update('api::supplier-autorag-config.supplier-autorag-config', config.id, {
      data: {
        api_endpoint: 'https://api.cloudflare.com/client/v4/accounts/a7c64d1d58510810b3c8f96d3631c8c9/ai/run/@cf/jina-ai/jina-embeddings-v2-base-en',
        status: 'active',
        sync_frequency: 'real-time'
      }
    });

    console.log('✅ Successfully updated AutoRAG configuration');
    console.log(`✓ New API endpoint: ${updatedConfig.api_endpoint}`);
    console.log(`✓ New status: ${updatedConfig.status}`);
    console.log(`✓ Sync frequency: ${updatedConfig.sync_frequency}`);
    
    // Verify the update
    const verifyConfig = await strapi.entityService.findOne('api::supplier-autorag-config.supplier-autorag-config', config.id);
    console.log('\n🔍 Verification:');
    console.log(`   API Endpoint: ${verifyConfig.api_endpoint}`);
    console.log(`   Status: ${verifyConfig.status}`);
    console.log(`   Sync Frequency: ${verifyConfig.sync_frequency}`);
    
  } catch (error) {
    console.error('❌ Error fixing AutoRAG config:', error);
  } finally {
    console.log('🏁 Script completed');
    process.exit(0);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  strapi().start().then(fixAutoRAGConfig);
}

module.exports = fixAutoRAGConfig;