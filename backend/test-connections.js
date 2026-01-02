// Test database and Redis connections
require('dotenv').config();
const { Client } = require('pg');

async function testDatabase() {
  console.log('Testing PostgreSQL connection...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Database connected successfully');
    const res = await client.query('SELECT NOW()');
    console.log('✅ Database query successful:', res.rows[0].now);
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function testRedis() {
  console.log('\nTesting Redis connection...');
  const Redis = require('ioredis');

  try {
    const redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 5000
    });

    await new Promise((resolve, reject) => {
      redis.once('ready', resolve);
      redis.once('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    console.log('✅ Redis connected successfully');
    await redis.ping();
    console.log('✅ Redis PING successful');
    redis.disconnect();
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    return false;
  }
}

async function main() {
  const dbOk = await testDatabase();
  const redisOk = await testRedis();

  console.log('\n=== Summary ===');
  console.log(`Database: ${dbOk ? '✅' : '❌'}`);
  console.log(`Redis: ${redisOk ? '✅' : '❌'}`);

  process.exit(dbOk && redisOk ? 0 : 1);
}

main();
