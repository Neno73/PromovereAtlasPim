/**
 * Test Script: Queue-Based Sync Flow
 * Tests the complete queue-based sync flow with a single supplier
 *
 * Usage:
 *   node scripts/test-queue-sync.js [supplierCode]
 *
 * Example:
 *   node scripts/test-queue-sync.js A360
 */

const { default: queueService } = require('../src/services/queue/queue-service');

async function testQueueSync() {
  const supplierCode = process.argv[2] || 'A360';

  console.log('🧪 Testing Queue-Based Sync Flow');
  console.log('='.repeat(60));
  console.log(`Supplier Code: ${supplierCode}\n`);

  try {
    // Step 1: Initialize queue service
    console.log('📋 Step 1: Initializing queue service...');
    await queueService.initialize();
    console.log('✅ Queue service initialized\n');

    // Step 2: Get supplier from database
    console.log('📦 Step 2: Fetching supplier from database...');
    const suppliers = await strapi.documents('api::supplier.supplier').findMany({
      filters: { code: supplierCode, is_active: true },
      limit: 1
    });

    if (!suppliers || suppliers.length === 0) {
      throw new Error(`Supplier ${supplierCode} not found or not active`);
    }

    const supplier = suppliers[0];
    console.log(`✅ Found supplier: ${supplier.code} - ${supplier.name}`);
    console.log(`   ID: ${supplier.id}`);
    console.log(`   Document ID: ${supplier.documentId}\n`);

    // Step 3: Enqueue supplier sync job
    console.log('🚀 Step 3: Enqueuing supplier sync job...');
    const supplierNumericId = typeof supplier.id === 'number' ? supplier.id : Number(supplier.id);

    const job = await queueService.enqueueSupplierSync(
      supplier.documentId,
      supplier.code,
      supplierNumericId,
      true // manual sync
    );

    console.log(`✅ Job enqueued successfully!`);
    console.log(`   Job ID: ${job.id}`);
    console.log(`   Queue: supplier-sync\n`);

    // Step 4: Monitor job progress
    console.log('👀 Step 4: Monitoring job progress...');
    console.log('   (Checking every 2 seconds for up to 2 minutes)');
    console.log('   Press Ctrl+C to stop monitoring\n');

    let attempts = 0;
    const maxAttempts = 60; // 2 minutes

    const monitorInterval = setInterval(async () => {
      attempts++;

      try {
        const jobData = await queueService.getJob('supplier-sync', job.id);

        if (!jobData) {
          console.log(`⚠️  Job ${job.id} not found`);
          clearInterval(monitorInterval);
          return;
        }

        const state = await jobData.getState();
        const progress = jobData.progress;

        // Clear line and print status
        process.stdout.write(`\r   Status: ${state.padEnd(15)} | Progress: ${JSON.stringify(progress || {})}`);

        // Check if job is complete or failed
        if (state === 'completed') {
          console.log('\n\n✅ Job completed successfully!');
          console.log('   Result:', JSON.stringify(jobData.returnvalue, null, 2));
          clearInterval(monitorInterval);

          // Show queue stats
          await showQueueStats();

          process.exit(0);
        } else if (state === 'failed') {
          console.log('\n\n❌ Job failed!');
          console.log('   Error:', jobData.failedReason);
          clearInterval(monitorInterval);

          // Show queue stats
          await showQueueStats();

          process.exit(1);
        }

        // Timeout after max attempts
        if (attempts >= maxAttempts) {
          console.log('\n\n⏱️  Timeout: Job still processing after 2 minutes');
          console.log('   Current state:', state);
          console.log('   You can check job status later using:');
          console.log(`   strapi.service('api::promidata-sync.promidata-sync').getJobStatus('supplier-sync', '${job.id}')`);
          clearInterval(monitorInterval);

          // Show queue stats
          await showQueueStats();

          process.exit(0);
        }

      } catch (error) {
        console.error('\n❌ Error monitoring job:', error.message);
        clearInterval(monitorInterval);
        process.exit(1);
      }
    }, 2000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

async function showQueueStats() {
  console.log('\n📊 Queue Statistics:');
  console.log('='.repeat(60));

  try {
    const stats = await queueService.getAllStats();

    console.log('\n🔹 Supplier Sync Queue:');
    console.log(`   Waiting: ${stats.supplierSync.waiting}`);
    console.log(`   Active: ${stats.supplierSync.active}`);
    console.log(`   Completed: ${stats.supplierSync.completed}`);
    console.log(`   Failed: ${stats.supplierSync.failed}`);

    console.log('\n🔹 Product Family Queue:');
    console.log(`   Waiting: ${stats.productFamily.waiting}`);
    console.log(`   Active: ${stats.productFamily.active}`);
    console.log(`   Completed: ${stats.productFamily.completed}`);
    console.log(`   Failed: ${stats.productFamily.failed}`);

    console.log('\n🔹 Image Upload Queue:');
    console.log(`   Waiting: ${stats.imageUpload.waiting}`);
    console.log(`   Active: ${stats.imageUpload.active}`);
    console.log(`   Completed: ${stats.imageUpload.completed}`);
    console.log(`   Failed: ${stats.imageUpload.failed}`);
    console.log();

  } catch (error) {
    console.error('Failed to get queue stats:', error.message);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  // This script should be run in the Strapi context
  console.error('❌ This script must be run in the Strapi context');
  console.error('   Use: npm run strapi console');
  console.error('   Then: const test = require("./scripts/test-queue-sync.js")');
  console.error('   Or integrate with Strapi bootstrap for testing');
  process.exit(1);
}

module.exports = testQueueSync;
