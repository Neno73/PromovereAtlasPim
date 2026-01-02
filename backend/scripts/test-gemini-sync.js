/**
 * Test Gemini Sync Script
 * Syncs 5 products to Gemini to verify integration.
 */

const { createStrapi } = require('@strapi/strapi');

async function run() {
    try {
        console.log('🚀 Starting Strapi...');
        const app = await createStrapi({ distDir: './dist' }).load();

        console.log('✅ Strapi loaded');


        // Note: In compiled JS/CommonJS, default export might be handled differently.
        // If using ts-node, we import source. If using node on dist, we import dist.
        // But here we are in a script, likely running with ts-node?
        // Let's assume we run this with `npx strapi console` or similar which sets up the environment.

        // Actually, the easiest way to run a script in Strapi context is:
        // node scripts/test-gemini-sync.js (if JS)

        // But our code is TS.
        // We should rely on the built service if possible.

        // Let's try to fetch products using Strapi API directly.

        const products = await app.documents('api::product.product').findMany({
            pagination: { page: 1, pageSize: 5 },
            populate: ['supplier', 'categories', 'price_tiers', 'dimensions']
        });

        console.log(`📦 Found ${products.length} products to sync`);

        // We need the service. 
        // If we can't easily import the TS service, we can copy the logic here or use app.service().
        // But gemini-service is not a registered API service (it's in services/gemini).
        // We can register it or just import it.

        // If we are running with ts-node, we can import the TS file.
        // If we are running with node, we need the JS file from dist.

        // Let's try to use the registered service if we registered it?
        // We didn't register 'gemini-service' in a global way, it's a module.

        // Let's try to import from dist if it exists.
        let geminiServiceModule;
        const path = require('path');
        const distPath = path.join(__dirname, '../dist/src/services/gemini/gemini-service');
        console.log('Trying to load:', distPath);

        try {
            geminiServiceModule = require(distPath);
        } catch (e) {
            console.log('⚠️ Could not load from dist:', e);
            console.log('Trying src (requires ts-node)...');
            geminiServiceModule = require('../src/services/gemini/gemini-service');
        }

        const service = geminiServiceModule.default || geminiServiceModule;

        for (const product of products) {
            console.log(`🔄 Syncing ${product.sku}...`);
            await service.upsertProduct(product);
        }

        console.log('✅ Test Sync Completed');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

run();
