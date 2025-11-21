/**
 * Import all products from Malfini supplier (A113)
 */

const { default: fetch } = require('node-fetch');

const STRAPI_BASE_URL = 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

async function importMalfiniProducts() {
  try {
    console.log('🚀 Starting Malfini (A113) product import...\n');

    // Find Malfini supplier
    console.log('🔍 Finding Malfini supplier...');
    const suppliersResponse = await fetch(`${STRAPI_BASE_URL}/api/suppliers?filters[code][$eq]=A113`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!suppliersResponse.ok) {
      throw new Error(`Failed to fetch suppliers: ${suppliersResponse.statusText}`);
    }

    const suppliersData = await suppliersResponse.json();
    if (suppliersData.data.length === 0) {
      console.log('❌ Malfini supplier (A113) not found');
      return;
    }

    const malfiniSupplier = suppliersData.data[0];
    console.log(`✅ Found supplier: ${malfiniSupplier.code} - ${malfiniSupplier.name}`);
    console.log(`📊 Auto-import enabled: ${malfiniSupplier.auto_import}`);
    console.log(`📈 Supplier ID: ${malfiniSupplier.id}\n`);

    // Start sync for Malfini
    console.log('🔄 Starting product sync...');
    const syncResponse = await fetch(`${STRAPI_BASE_URL}/api/promidata-sync/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        supplierId: malfiniSupplier.id
      })
    });

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text();
      throw new Error(`Sync request failed (${syncResponse.status}): ${errorText}`);
    }

    const result = await syncResponse.json();
    console.log('✅ Sync initiated successfully!\n');
    console.log('📊 Sync Results:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.data && result.data.results) {
      const syncResult = result.data.results[0];
      if (syncResult) {
        console.log('\n📈 Import Summary:');
        console.log(`• Supplier: ${syncResult.supplier}`);
        console.log(`• Success: ${syncResult.success}`);
        if (syncResult.success) {
          console.log(`• Products processed: ${syncResult.productsProcessed || 'N/A'}`);
          console.log(`• Imported: ${syncResult.imported || 0}`);
          console.log(`• Updated: ${syncResult.updated || 0}`);
          console.log(`• Skipped: ${syncResult.skipped || 0}`);
          console.log(`• Errors: ${syncResult.errors || 0}`);
        } else {
          console.log(`• Error: ${syncResult.error}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Import failed:', error.message);
  }
}

// Run the import
importMalfiniProducts();