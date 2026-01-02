const { Client } = require('pg');
require('dotenv').config();

console.log('🔍 Testing Neon PostgreSQL connection...\n');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables!');
  process.exit(1);
}

console.log('✓ DATABASE_URL is set');
console.log(`✓ Connection string length: ${connectionString.length} characters`);
console.log(`✓ DATABASE_CLIENT: ${process.env.DATABASE_CLIENT || 'not set'}\n`);

// Test connection
const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: true
  }
});

async function testConnection() {
  try {
    console.log('🔌 Attempting to connect...');
    await client.connect();
    console.log('✅ Successfully connected to Neon!\n');

    // Test a simple query
    console.log('📊 Testing query...');
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Query successful!');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}\n`);

    // Check number of active connections
    const connResult = await client.query(`
      SELECT count(*) as connection_count
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    console.log(`📈 Active connections to this database: ${connResult.rows[0].connection_count}\n`);

  } catch (error) {
    console.error('❌ Connection failed!');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);

    if (error.code === 'ECONNRESET') {
      console.error('\n💡 ECONNRESET typically means:');
      console.error('   - Network connectivity issue');
      console.error('   - Database server closed the connection');
      console.error('   - Too many connections (check Neon dashboard)');
      console.error('   - Firewall or proxy issue');
    }

    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Connection closed');
  }
}

testConnection();
