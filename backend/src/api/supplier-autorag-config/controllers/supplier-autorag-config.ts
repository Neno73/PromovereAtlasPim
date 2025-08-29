import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::supplier-autorag-config.supplier-autorag-config', ({ strapi }) => ({

  /**
   * Fix AutoRAG configuration for Malfini supplier
   */
  async fixConfiguration(ctx) {
    try {
      console.log('🔧 Fixing AutoRAG configuration for Malfini...');
      
      // Find existing AutoRAG config for Malfini
      const existingConfigs = await strapi.entityService.findMany('api::supplier-autorag-config.supplier-autorag-config', {
        filters: { 
          autorag_id: 'malfini-rag'
        },
        populate: ['supplier']
      });
      
      if (existingConfigs.length > 0) {
        const config = existingConfigs[0];
        console.log(`📍 Found existing config: ${config.id} for supplier ${(config as any).supplier?.code || 'unknown'}`);
        
        // Update the configuration with correct R2 bucket URL
        const updatedConfig = await strapi.entityService.update('api::supplier-autorag-config.supplier-autorag-config', config.id, {
          data: {
            api_endpoint: 'https://a7c64d1d58510810b3c8f96d3631c8c9.r2.cloudflarestorage.com/malfini',
            status: 'active',
            sync_frequency: 'real-time'
          }
        });
        
        ctx.body = {
          success: true,
          message: 'AutoRAG configuration updated successfully',
          config: {
            id: updatedConfig.id,
            api_endpoint: updatedConfig.api_endpoint,
            status: updatedConfig.status,
            sync_frequency: updatedConfig.sync_frequency,
            supplier: (config as any).supplier?.code || 'unknown'
          }
        };
        
        console.log('✅ Successfully updated AutoRAG configuration');
        
      } else {
        // Find Malfini supplier and create config
        const suppliers = await strapi.entityService.findMany('api::supplier.supplier', {
          filters: { code: 'A113' }
        });
        
        if (suppliers.length > 0) {
          const supplier = suppliers[0];
          console.log(`📍 Creating new AutoRAG config for supplier: ${supplier.code} - ${supplier.name}`);
          
          const newConfig = await strapi.entityService.create('api::supplier-autorag-config.supplier-autorag-config', {
            data: {
              supplier: supplier.id,
              autorag_id: 'malfini-rag',
              cloudflare_account_id: 'a7c64d1d58510810b3c8f96d3631c8c9',
              api_endpoint: 'https://a7c64d1d58510810b3c8f96d3631c8c9.r2.cloudflarestorage.com/malfini',
              status: 'active',
              sync_frequency: 'real-time',
              company_context: 'Malfini promotional products supplier'
            }
          });
          
          ctx.body = {
            success: true,
            message: 'AutoRAG configuration created successfully',
            config: {
              id: newConfig.id,
              api_endpoint: newConfig.api_endpoint,
              status: newConfig.status,
              sync_frequency: newConfig.sync_frequency,
              supplier: supplier.code,
              autorag_id: newConfig.autorag_id
            }
          };
          
          console.log('✅ Successfully created new AutoRAG configuration');
        } else {
          ctx.throw(404, 'Malfini supplier (A113) not found');
        }
      }
    } catch (error) {
      strapi.log.error('Fix AutoRAG configuration failed:', error);
      ctx.throw(500, error.message);
    }
  },

  /**
   * Test AutoRAG sync functionality
   */
  async testAutoRAGSync(ctx) {
    try {
      console.log('🧪 Testing AutoRAG sync functionality...');
      
      // Get the AutoRAG service
      const autoragService = require('../../../services/autorag').default;
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
      console.log('Product:', JSON.stringify(testProduct, null, 2));
      
      // Test the upload
      const result = await autoragService.uploadProduct(testConfig, testProduct);
      
      ctx.body = {
        success: result,
        message: result ? 'Product uploaded successfully to R2 bucket!' : 'Product upload failed',
        config: testConfig,
        product: testProduct
      };
      
      if (result) {
        console.log('✅ Product uploaded successfully to R2 bucket!');
      } else {
        console.log('❌ Product upload failed');
      }
      
    } catch (error) {
      console.error('❌ Error testing AutoRAG sync:', error);
      ctx.throw(500, error.message);
    }
  },

  /**
   * Bulk sync all A113 products to AutoRAG
   */
  async bulkSyncA113ToAutoRAG(ctx) {
    try {
      console.log('🔄 Starting bulk sync of A113 products to AutoRAG...');
      
      // Get the AutoRAG service
      const autoragService = require('../../../services/autorag').default;
      console.log('📦 AutoRAG service loaded');
      
      // Find A113 supplier with AutoRAG config
      const suppliers = await strapi.entityService.findMany('api::supplier.supplier', {
        filters: { code: 'A113' },
        populate: ['autorag_config']
      });
      
      if (!suppliers.length) {
        ctx.throw(404, 'A113 supplier not found');
      }
      
      const supplier = suppliers[0];
      const autoragConfigData = (supplier as any).autorag_config;
      if (!autoragConfigData) {
        ctx.throw(400, 'A113 supplier has no AutoRAG configuration');
      }
      
      console.log(`📍 Found supplier: ${supplier.code} with AutoRAG config`);
      
      // Get all A113 products
      const products = await strapi.entityService.findMany('api::product.product', {
        filters: { 
          supplier: supplier.id,
          is_active: true
        },
        populate: ['categories', 'main_image', 'gallery_images', 'supplier'],
        limit: -1 // Get all products
      });
      
      console.log(`📊 Found ${products.length} active A113 products to sync`);
      
      const autoragConfig = {
        autorag_id: autoragConfigData.autorag_id,
        cloudflare_account_id: autoragConfigData.cloudflare_account_id,
        api_endpoint: autoragConfigData.api_endpoint
      };
      
      let success = 0;
      let failed = 0;
      const errors = [];
      
      // Process products in batches
      const batchSize = 5;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(products.length/batchSize)} (${batch.length} products)`);
        
        const promises = batch.map(async (product) => {
          try {
            const transformedProduct = autoragService.transformProductForAutoRAG(product);
            const result = await autoragService.uploadProduct(autoragConfig, transformedProduct);
            if (result) {
              success++;
              console.log(`✅ Uploaded ${product.sku} to AutoRAG`);
            } else {
              failed++;
              errors.push(`Failed to upload ${product.sku}`);
              console.log(`❌ Failed to upload ${product.sku}`);
            }
          } catch (error) {
            failed++;
            errors.push(`Error uploading ${product.sku}: ${error.message}`);
            console.error(`❌ Error uploading ${product.sku}:`, error.message);
          }
        });
        
        await Promise.all(promises);
        
        // Small delay between batches
        if (i + batchSize < products.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Update product count in AutoRAG config
      await strapi.entityService.update('api::supplier-autorag-config.supplier-autorag-config', autoragConfigData.id, {
        data: {
          products_in_autorag: success,
          last_sync_date: new Date(),
          last_sync_status: failed > 0 ? 'failed' : 'completed',
          last_sync_message: `Bulk sync: ${success} uploaded, ${failed} failed`
        }
      });
      
      ctx.body = {
        success: true,
        message: `Bulk sync completed: ${success} products uploaded, ${failed} failed`,
        stats: {
          total_products: products.length,
          uploaded: success,
          failed: failed,
          success_rate: Math.round((success / products.length) * 100)
        },
        errors: failed > 0 ? errors.slice(0, 10) : [], // Show first 10 errors
        autorag_id: autoragConfig.autorag_id
      };
      
      console.log(`✅ Bulk sync completed: ${success}/${products.length} products uploaded to AutoRAG`);
      
    } catch (error) {
      console.error('❌ Bulk sync failed:', error);
      ctx.throw(500, error.message);
    }
  },
  
}));