const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Redis configuration (matching backend defaults)
const connection = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

async function cleanQueue() {
    console.log('🧹 Connecting to gemini-sync queue...');

    const queue = new Queue('gemini-sync', { connection });

    try {
        // Get current counts
        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
        console.log('📊 Current Queue Status:');
        console.log(`   - Waiting: ${counts.waiting}`);
        console.log(`   - Active: ${counts.active}`);
        console.log(`   - Completed: ${counts.completed}`);
        console.log(`   - Failed: ${counts.failed}`);
        console.log(`   - Delayed: ${counts.delayed}`);

        if (counts.waiting === 0 && counts.failed === 0 && counts.delayed === 0) {
            console.log('✅ Queue is already clean!');
            return;
        }

        console.log('\n🗑️  Cleaning queue...');

        // Clean waiting jobs (the 50k backlog)
        if (counts.waiting > 0) {
            console.log(`   Cleaning ${counts.waiting} waiting jobs...`);
            await queue.clean(0, 0, 'wait');
            console.log('   ✅ Waiting jobs removed');
        }

        // Clean delayed jobs
        if (counts.delayed > 0) {
            console.log(`   Cleaning ${counts.delayed} delayed jobs...`);
            await queue.clean(0, 0, 'delayed');
            console.log('   ✅ Delayed jobs removed');
        }

        // Clean failed jobs (optional - keeping them might be useful for debug, but user asked to clean)
        if (counts.failed > 0) {
            console.log(`   Cleaning ${counts.failed} failed jobs...`);
            await queue.clean(0, 0, 'failed');
            console.log('   ✅ Failed jobs removed');
        }

        // Clean completed jobs
        if (counts.completed > 0) {
            console.log(`   Cleaning ${counts.completed} completed jobs...`);
            await queue.clean(0, 0, 'completed');
            console.log('   ✅ Completed jobs removed');
        }

        // Verify
        const newCounts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
        console.log('\n✨ Final Queue Status:');
        console.log(`   - Waiting: ${newCounts.waiting}`);
        console.log(`   - Active: ${newCounts.active}`);
        console.log(`   - Completed: ${newCounts.completed}`);
        console.log(`   - Failed: ${newCounts.failed}`);

    } catch (error) {
        console.error('❌ Error cleaning queue:', error);
    } finally {
        await queue.close();
        connection.disconnect();
        console.log('\n👋 Done');
    }
}

cleanQueue();
