/**
 * Script to activate all suppliers (set is_active = true)
 * Run with: node scripts/activate-all-suppliers.js
 */

require('dotenv').config();
const { Client } = require('pg');

async function activateSuppliers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Update all suppliers to active
    const result = await client.query(`
      UPDATE suppliers
      SET is_active = true
      WHERE is_active = false OR is_active IS NULL;
    `);

    console.log(`✅ Updated ${result.rowCount} suppliers to is_active = true`);

    // Show current status
    const suppliers = await client.query(`
      SELECT code, name, is_active
      FROM suppliers
      ORDER BY code
      LIMIT 10;
    `);

    console.log('\n📊 First 10 suppliers:');
    suppliers.rows.forEach(s => {
      console.log(`  ${s.code}: ${s.name} - is_active = ${s.is_active}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

activateSuppliers();
