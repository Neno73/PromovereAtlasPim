#!/usr/bin/env node
/**
 * Queue 5 Test Products for Gemini Sync
 * 
 * Uses the sample product IDs from Meilisearch to test the sync pipeline
 */

require('dotenv').config();
const { Queue } = require('bullmq');
const { MeiliSearch } = require('meilisearch');
const Redis = require('ioredis');

// Redis configuration
const connection = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

async function queueTestJobs() {
    console.log('🧪 Queuing 5 Test Products for Gemini Sync\n');

    // Connect to Meilisearch to get sample products
    const meiliClient = new MeiliSearch({
        host: process.env.MEILISEARCH_HOST || 'http://127.0.0.1:7700',
        apiKey: process.env.MEILISEARCH_ADMIN_KEY || '',
    });

    const indexName = process.env.MEILISEARCH_INDEX_NAME || 'pim_products';
    const index = meiliClient.index(indexName);

    // Get 5 sample products
    const searchResult = await index.search('', { limit: 5 });
    const products = searchResult.hits;

    console.log('📦 Sample Products from Meilisearch:');
    products.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.id} (SKU: ${p.sku}, Name: ${p.name_en?.substring(0, 40) || 'N/A'}...)`);
    });

    // Connect to queue
    const queue = new Queue('gemini-sync', { connection });

    console.log('\n📤 Queuing jobs...');

    const jobIds = [];
    for (const product of products) {
        const job = await queue.add(
            'sync-product',
            {
                operation: 'update',
                documentId: product.id,
            },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            }
        );
        jobIds.push(job.id);
        console.log(`   ✅ Queued: ${product.id} (Job ID: ${job.id})`);
    }

    // Get queue status
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
    console.log('\n📊 Queue Status After Adding Jobs:');
    console.log(`   - Waiting: ${counts.waiting}`);
    console.log(`   - Active: ${counts.active}`);
    console.log(`   - Completed: ${counts.completed}`);
    console.log(`   - Failed: ${counts.failed}`);

    console.log('\n🔍 Job IDs to Monitor:');
    jobIds.forEach((id, i) => console.log(`   ${i + 1}. ${id}`));

    console.log('\n⏳ Watch the backend console for processing logs...');
    console.log('   Look for: ✅ [Gemini] Completed update for {id}');
    console.log('   Or: ❌ Failed to sync product {id}');

    await queue.close();
    connection.disconnect();
}

queueTestJobs().catch(console.error);
