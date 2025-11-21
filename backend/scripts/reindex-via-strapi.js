/**
 * Reindex Products via Strapi Meilisearch Service
 * 
 * Uses Strapi's existing Meilisearch service to reindex products
 */

const { createStrapi } = require('@strapi/strapi');

const PRODUCT_LIMIT = parseInt(process.env.REINDEX_LIMIT || '10');

async function reindexViaStrapi() {
    let app;

    try {
        console.log(`🚀 Reindexing ${PRODUCT_LIMIT} products via Strapi Meilisearch service...\n`);

        // 1. Load Strapi
        console.log('📦 Loading Strapi...');
        app = await createStrapi({ distDir: './dist' }).load();
        console.log('✅ Strapi loaded\n');

        // 2. Get Meilisearch service
        console.log('🔍 Getting Meilisearch service...');
        const meilisearchService = app.service('api::product.meilisearch');

        if (!meilisearchService) {
            throw new Error('Meilisearch service not found. Is the plugin enabled?');
        }
        console.log('✅ Meilisearch service found\n');

        // 3. Initialize index
        console.log('🔨 Initializing index...');
        await meilisearchService.initializeIndex();
        await meilisearchService.configureIndexSettings();
        console.log('✅ Index initialized and configured\n');

        // 4. Get products from database
        console.log(`📊 Fetching ${PRODUCT_LIMIT} active products...`);
        const products = await app.db.query('api::product.product').findMany({
            where: { is_active: true },
            limit: PRODUCT_LIMIT,
            populate: ['supplier', 'categories', 'variants', 'main_image', 'gallery_images', 'price_tiers', 'dimensions']
        });
        console.log(`✅ Found ${products.length} products\n`);

        // 5. Bulk index
        console.log('🔄 Indexing products...');
        const stats = await meilisearchService.bulkAddOrUpdateDocuments(products, 100);

        console.log('✅ Indexing complete!\n');

        // 6. Show stats
        console.log('📊 Index Stats:');
        console.log(`   Total documents: ${stats.numberOfDocuments}`);
        console.log(`   Indexing: ${stats.isIndexing ? 'Yes' : 'No'}`);
        console.log(`   Field distribution: ${Object.keys(stats.fieldDistribution || {}).length} fields`);
        console.log('');

        // 7. Test search
        console.log('🧪 Testing search...');
        const searchResults = await meilisearchService.searchProducts({
            query: '',
            limit: 5
        });

        console.log(`   Found ${searchResults.hits.length} products`);
        if (searchResults.hits.length > 0) {
            console.log(`   Sample: ${searchResults.hits[0].name_en || searchResults.hits[0].sku}`);
        }
        console.log('');

        console.log('🎉 Reindexing complete!');
        console.log(`\n✅ Summary:`);
        console.log(`   Products indexed: ${products.length}`);
        console.log(`   Index name: promoatlas_products`);
        console.log(`   Search working: ✅`);

        await app.destroy();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        if (app) await app.destroy();
        process.exit(1);
    }
}

reindexViaStrapi();
