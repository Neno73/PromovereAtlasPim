const { Queue } = require('bullmq');
require('dotenv').config();

async function clearQueue() {
    // Redis connection settings
    const connection = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
    };

    console.log('🗑️  Clearing Gemini Sync queue...');
    console.log('🔌 Connecting to Redis at:', connection.host, connection.port);

    const queue = new Queue('gemini-sync', { connection });

    try {
        // Pause the queue to ensure no jobs are processed while clearing
        await queue.pause();

        // Obliterate removes the queue and all its data
        // force: true allows removing even if there are active jobs
        await queue.obliterate({ force: true });

        console.log('✅ Queue "gemini-sync" has been successfully cleared (obliterated).');
    } catch (error) {
        console.error('❌ Failed to clear queue:', error);
    } finally {
        await queue.close();
        process.exit(0);
    }
}

clearQueue();
