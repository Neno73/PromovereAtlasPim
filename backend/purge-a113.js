#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function purgeA113Products() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🗑️ Starting A113 product purge...');
    
    // Get supplier ID
    const supplierResult = await pool.query("SELECT id FROM suppliers WHERE code = 'A113'");
    if (supplierResult.rows.length === 0) {
      console.log('❌ A113 supplier not found');
      return;
    }
    
    const supplierId = supplierResult.rows[0].id;
    console.log(`📋 Found A113 supplier ID: ${supplierId}`);
    
    // Count products before deletion
    const countResult = await pool.query('SELECT COUNT(*) FROM products WHERE supplier_id = $1', [supplierId]);
    const productCount = parseInt(countResult.rows[0].count);
    console.log(`📦 Found ${productCount} A113 products to delete`);
    
    if (productCount === 0) {
      console.log('✅ No A113 products to delete');
      return;
    }
    
    // Delete all A113 products
    console.log('🗑️ Deleting all A113 products...');
    const deleteResult = await pool.query('DELETE FROM products WHERE supplier_id = $1', [supplierId]);
    
    console.log(`✅ Successfully deleted ${deleteResult.rowCount} A113 products`);
    
    // Verify deletion
    const verifyResult = await pool.query('SELECT COUNT(*) FROM products WHERE supplier_id = $1', [supplierId]);
    const remainingCount = parseInt(verifyResult.rows[0].count);
    console.log(`🔍 Remaining A113 products: ${remainingCount}`);
    
    if (remainingCount === 0) {
      console.log('✅ A113 product purge completed successfully!');
    } else {
      console.log('⚠️ Some products may still remain');
    }
    
  } catch (error) {
    console.error('❌ Purge failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

purgeA113Products();