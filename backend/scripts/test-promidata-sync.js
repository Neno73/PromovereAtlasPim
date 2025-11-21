/**
 * Test Promidata Sync System
 * Quick test script to verify the sync functionality
 */

const { default: fetch } = require('node-fetch');

const STRAPI_BASE_URL = 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

async function testPromidataConnection() {
  console.log('🔍 Testing Promidata API connection...');

  try {
    // Test connection to Promidata
    const response = await fetch(`${STRAPI_BASE_URL}/api/promidata-sync/test-connection`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Connection test result:', result);
    return result;
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return null;
  }
}

async function importCategories() {
  console.log('📁 Importing categories from Promidata...');

  try {
    const response = await fetch(`${STRAPI_BASE_URL}/api/promidata-sync/import-categories`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Categories imported:', result);
    return result;
  } catch (error) {
    console.error('❌ Category import failed:', error.message);
    return null;
  }
}

async function getSyncStatus() {
  console.log('📊 Getting sync status...');

  try {
    const response = await fetch(`${STRAPI_BASE_URL}/api/promidata-sync/status`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Sync status:', result);
    return result;
  } catch (error) {
    console.error('❌ Failed to get sync status:', error.message);
    return null;
  }
}

async function testSingleSupplierSync() {
  console.log('🔄 Testing sync for a single supplier...');

  try {
    // Get first active supplier
    const suppliersResponse = await fetch(`${STRAPI_BASE_URL}/api/suppliers?filters[is_active][$eq]=true&pagination[limit]=1`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!suppliersResponse.ok) {
      throw new Error(`Failed to get suppliers: ${suppliersResponse.statusText}`);
    }

    const suppliersData = await suppliersResponse.json();
    if (suppliersData.data.length === 0) {
      console.log('⚠️ No active suppliers found');
      return null;
    }

    const supplier = suppliersData.data[0];
    console.log(`🏢 Testing sync for supplier: ${supplier.code} - ${supplier.name}`);

    // Start sync for this supplier
    const syncResponse = await fetch(`${STRAPI_BASE_URL}/api/promidata-sync/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        supplierId: supplier.id
      })
    });

    if (!syncResponse.ok) {
      throw new Error(`HTTP ${syncResponse.status}: ${syncResponse.statusText}`);
    }

    const result = await syncResponse.json();
    console.log('✅ Sync completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Supplier sync failed:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting Promidata Sync Test\n');

  // Test 1: Connection
  await testPromidataConnection();
  console.log('');

  // Test 2: Import Categories
  await importCategories();
  console.log('');

  // Test 3: Get Sync Status
  await getSyncStatus();
  console.log('');

  // Test 4: Test Single Supplier Sync
  await testSingleSupplierSync();
  console.log('');

  console.log('🎉 Test completed!');
}

// Run the test
main().catch(console.error);