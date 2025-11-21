const { createStrapi } = require('@strapi/strapi');
const path = require('path');

async function run() {
    // Load Strapi
    const appDir = path.resolve(__dirname, '..');
    const strapi = await createStrapi({ appDir, distDir: path.join(appDir, 'dist') }).load();

    console.log('🚀 Triggering Gemini Sync via Script...');

    try {
        // Import the compiled Queue Service
        // Note: Adjust path based on where this script is located (root/scripts)
        const queueService = require('../dist/src/services/queue/queue-service').default;

        if (!queueService) {
            throw new Error('Could not load QueueService');
        }

        const batchSize = 50;
        let page = 1;
        let processed = 0;
        let errors = 0;

        while (true) {
            const products = await strapi.documents('api::product.product').findMany({
                pagination: { page, pageSize: batchSize },
                fields: ['sku']
            });

            if (products.length === 0) break;

            console.log(`[Script] Enqueuing batch ${page} (${products.length} products)...`);

            try {
                const jobs = products.map(product => ({
                    operation: 'update',
                    documentId: product.documentId
                }));

                await queueService.enqueueGeminiSyncBatch(jobs);
                processed += products.length;
            } catch (err) {
                console.error(`[Script] Failed to enqueue batch ${page}:`, err);
                errors += products.length;
            }

            page++;
        }

        console.log(`✅ Full Gemini Sync Enqueued. Jobs created: ${processed}, Failed batches: ${errors}`);

    } catch (error) {
        console.error('❌ Error:', error);
    }

    // Keep alive briefly to allow logs to flush or queues to acknowledge
    setTimeout(() => {
        process.exit(0);
    }, 2000);
}

run();
