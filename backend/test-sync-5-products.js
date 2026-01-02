/**
 * Test Gemini Sync with 5 Real Products
 * 
 * This script:
 * 1. Loads Strapi
 * 2. Fetches 5 real products from the database
 * 3. Uses the compiled gemini-service to upload them
 */

const { createStrapi } = require('@strapi/strapi');
const path = require('path');

async function run() {
    let app;
    try {
        console.log('🚀 Loading Strapi...');
        app = await createStrapi({ distDir: './dist' }).load();
        console.log('✅ Strapi loaded\n');

        // Load the compiled gemini service
        const geminiService = require(path.join(__dirname, 'dist/src/services/gemini/gemini-service')).default;

        console.log('📦 Fetching 5 products from database...');
        const products = await app.db.query('api::product.product').findMany({
            limit: 5,
            populate: ['supplier', 'categories', 'price_tiers', 'dimensions']
        });

        console.log(`Found ${products.length} products\n`);

        let successCount = 0;
        let errorCount = 0;

        for (const product of products) {
            try {
                console.log(`🔄 Syncing: ${product.sku}...`);
                await geminiService.upsertProduct(product);
                successCount++;
            } catch (err) {
                console.error(`❌ Failed: ${product.sku} - ${err.message}`);
                errorCount++;
            }
        }

        console.log(`\n✅ Sync Complete!`);
        console.log(`   Success: ${successCount}`);
        console.log(`   Errors: ${errorCount}`);

        await app.destroy();
        process.exit(0);

    } catch (error) {
        console.error('❌ Fatal Error:', error);
        if (app) await app.destroy();
        process.exit(1);
    }
}

run();
