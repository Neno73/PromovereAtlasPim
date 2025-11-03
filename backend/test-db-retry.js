const { Client } = require('pg');
require('dotenv').config();

console.log('🔍 Testing Neon connection with retries (for auto-suspended DB)...\n');

const connectionString = process.env.DATABASE_URL;
const maxRetries = 3;
const retryDelay = 2000; // 2 seconds

async function connectWithRetry(attempt = 1) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, // 10 second timeout
  });

  try {
    console.log(`🔌 Attempt ${attempt}/${maxRetries}: Connecting...`);
    await client.connect();
    console.log('✅ Successfully connected!\n');

    // Test query
    const result = await client.query('SELECT NOW() as time, current_database() as db');
    console.log(`✅ Query successful!`);
    console.log(`   Time: ${result.rows[0].time}`);
    console.log(`   Database: ${result.rows[0].db}\n`);

    // Check active connections
    const connQuery = await client.query(`
      SELECT count(*) as total,
             count(*) FILTER (WHERE state = 'active') as active,
             count(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    console.log('📊 Connection stats:');
    console.log(`   Total: ${connQuery.rows[0].total}`);
    console.log(`   Active: ${connQuery.rows[0].active}`);
    console.log(`   Idle: ${connQuery.rows[0].idle}\n`);

    await client.end();
    console.log('✅ Database is healthy and ready!');
    process.exit(0);

  } catch (error) {
    await client.end().catch(() => {});

    console.error(`❌ Attempt ${attempt} failed: ${error.message}`);

    if (error.code === 'ECONNRESET' && attempt < maxRetries) {
      console.log(`⏳ Database might be waking up from suspend state...`);
      console.log(`   Waiting ${retryDelay/1000}s before retry ${attempt + 1}...\n`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return connectWithRetry(attempt + 1);
    }

    console.error('\n💥 All attempts failed!');
    console.error('\n💡 Possible issues:');
    console.error('   1. Database suspended - Neon free tier auto-suspends after 5min inactivity');
    console.error('   2. Too many connections - Check Neon dashboard for connection limit');
    console.error('   3. Check Neon dashboard at https://console.neon.tech');
    process.exit(1);
  }
}

connectWithRetry();
