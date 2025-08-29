const { createStrapi } = require('@strapi/strapi');

async function fixAutoRAGConfig() {
  let strapi = null;
  
  try {
    console.log('🔄 Starting Strapi instance...');
    
    // Create a minimal Strapi instance
    strapi = await createStrapi();
    await strapi.load();
    
    console.log('✅ Strapi loaded successfully');
    
    // Find existing AutoRAG config for Malfini
    const existingConfigs = await strapi.db.query('api::supplier-autorag-config.supplier-autorag-config').findMany({
      where: { 
        autorag_id: 'malfini-rag'
      },
      populate: {
        supplier: true
      }
    });
    
    console.log(`📍 Found ${existingConfigs.length} existing AutoRAG configs`);
    
    if (existingConfigs.length > 0) {
      const config = existingConfigs[0];
      console.log(`📋 Existing config ID: ${config.id}`);
      console.log(`📋 Current API endpoint: ${config.api_endpoint}`);
      console.log(`📋 Current status: ${config.status}`);
      console.log(`📋 Supplier: ${config.supplier?.code || 'unknown'}`);
      
      // Update the configuration
      const updatedConfig = await strapi.db.query('api::supplier-autorag-config.supplier-autorag-config').update({
        where: { id: config.id },
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
      
    } else {
      // Find Malfini supplier and create config
      const malfinisuppliers = await strapi.db.query('api::supplier.supplier').findMany({
        where: { code: 'A113' }
      });
      
      if (malfinisuppliers.length > 0) {
        const supplier = malfinisuppliers[0];
        console.log(`📍 Found Malfini supplier: ${supplier.code} - ${supplier.name}`);
        
        const newConfig = await strapi.db.query('api::supplier-autorag-config.supplier-autorag-config').create({
          data: {
            supplier: supplier.id,
            autorag_id: 'malfini-rag',
            cloudflare_account_id: 'a7c64d1d58510810b3c8f96d3631c8c9',
            api_endpoint: 'https://api.cloudflare.com/client/v4/accounts/a7c64d1d58510810b3c8f96d3631c8c9/ai/run/@cf/jina-ai/jina-embeddings-v2-base-en',
            status: 'active',
            sync_frequency: 'real-time',
            company_context: 'Malfini promotional products supplier'
          }
        });
        
        console.log('✅ Successfully created new AutoRAG configuration');
        console.log(`✓ Config ID: ${newConfig.id}`);
        console.log(`✓ API endpoint: ${newConfig.api_endpoint}`);
        console.log(`✓ Status: ${newConfig.status}`);
      } else {
        console.log('❌ Malfini supplier not found');
      }
    }
    
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

// Run the fix
fixAutoRAGConfig();