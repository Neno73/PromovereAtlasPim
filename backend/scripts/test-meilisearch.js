/**
 * Test Meilisearch Connection
 */

const { MeiliSearch } = require('meilisearch');
require('dotenv').config();

async function testConnection() {
    console.log('Testing Meilisearch connection...\n');

    console.log('Configuration:');
    console.log('  Host:', process.env.MEILISEARCH_HOST);
    console.log('  Admin Key:', process.env.MEILISEARCH_ADMIN_KEY?.substring(0, 10) + '...');
    console.log('');

    const client = new MeiliSearch({
        host: process.env.MEILISEARCH_HOST,
        apiKey: process.env.MEILISEARCH_ADMIN_KEY
    });

    try {
        // Test 1: Get version
        console.log('Test 1: Getting version...');
        const version = await client.getVersion();
        console.log('✅ Version:', version.pkgVersion);
        console.log('');

        // Test 2: List indexes
        console.log('Test 2: Listing indexes...');
        const indexes = await client.getIndexes();
        console.log(`✅ Found ${indexes.results.length} indexes:`);
        indexes.results.forEach((idx, i) => {
            console.log(`   ${i + 1}. ${idx.uid} (${idx.primaryKey || 'no primary key'})`);
        });
        console.log('');

        // Test 3: Get specific index
        console.log('Test 3: Checking promoatlas_products index...');
        try {
            const index = await client.getIndex('promoatlas_products');
            const stats = await index.getStats();
            console.log(`✅ Index exists with ${stats.numberOfDocuments} documents`);
        } catch (e) {
            console.log('⚠️  Index does not exist (will create)');
        }

        console.log('\n✅ All tests passed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.cause) {
            console.error('   Cause:', error.cause);
        }
        process.exit(1);
    }
}

testConnection();
