/**
 * Test Queue Connection
 * Simple script to verify BullMQ can connect to Upstash Redis
 */

require('dotenv').config();

async function testQueueConnection() {
  console.log('🧪 Testing Queue Service Connection...\n');

  try {
    // Import queue service
    console.log('1️⃣  Importing queue service...');
    const queueService = require('./dist/src/services/queue/queue-service').default;

    // Initialize
    console.log('2️⃣  Initializing queue service...');
    await queueService.initialize();

    // Get queue stats
    console.log('\n3️⃣  Fetching queue statistics...');
    const stats = await queueService.getQueueStats();
    console.log('   Queue Statistics:');
    console.log('   - Supplier Sync:', stats.supplierSync);
    console.log('   - Product Family:', stats.productFamily);
    console.log('   - Image Upload:', stats.imageUpload);

    // Shutdown
    console.log('\n4️⃣  Shutting down queue service...');
    await queueService.shutdown();

    console.log('\n✅ All tests passed! Queue service is working correctly.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testQueueConnection();
