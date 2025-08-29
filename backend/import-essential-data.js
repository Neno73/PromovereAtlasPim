#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function importEssentialData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('📦 Starting essential data import...');
    
    // Read export data
    const exportData = JSON.parse(fs.readFileSync('./essential-data-export.json', 'utf8'));
    console.log('📄 Export data loaded from file');
    
    // Import suppliers
    if (exportData.suppliers && exportData.suppliers.length > 0) {
      console.log(`📋 Importing ${exportData.suppliers.length} suppliers...`);
      for (const supplier of exportData.suppliers) {
        // Check if supplier already exists by code
        const existing = await pool.query('SELECT id FROM suppliers WHERE code = $1', [supplier.code]);
        
        if (existing.rows.length === 0) {
          const { id, ...supplierData } = supplier;
          
          const insertQuery = `
            INSERT INTO suppliers (
              document_id, code, name, is_active, auto_import, 
              created_at, updated_at, published_at, created_by_id, updated_by_id,
              locale, last_sync_date, last_sync_status, last_sync_message,
              products_count, last_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          `;
          
          await pool.query(insertQuery, [
            supplierData.document_id, supplierData.code, supplierData.name,
            supplierData.is_active, supplierData.auto_import,
            supplierData.created_at, supplierData.updated_at, supplierData.published_at,
            supplierData.created_by_id, supplierData.updated_by_id, supplierData.locale,
            supplierData.last_sync_date, supplierData.last_sync_status, supplierData.last_sync_message,
            supplierData.products_count, supplierData.last_hash
          ]);
        }
      }
      console.log(`✅ Imported suppliers`);
    }
    
    // Import categories
    if (exportData.categories && exportData.categories.length > 0) {
      console.log(`📋 Importing ${exportData.categories.length} categories...`);
      for (const category of exportData.categories) {
        // Check if category already exists by code
        const existing = await pool.query('SELECT id FROM categories WHERE code = $1', [category.promidata_code]);
        
        if (existing.rows.length === 0) {
          const { id, promidata_code, ...categoryData } = category;
          
          const insertQuery = `
            INSERT INTO categories (
              document_id, name, code, sort_order, created_at, updated_at, 
              published_at, created_by_id, updated_by_id, locale
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `;
          
          await pool.query(insertQuery, [
            categoryData.document_id, categoryData.name, promidata_code, categoryData.sort_order,
            categoryData.created_at, categoryData.updated_at, categoryData.published_at,
            categoryData.created_by_id, categoryData.updated_by_id, categoryData.locale
          ]);
        }
      }
      console.log(`✅ Imported categories`);
    }
    
    // Skip sync configurations for now - schema doesn't match
    console.log('ℹ️ Skipping sync configurations (will be created automatically on first sync)');
    
    // Skip admin users, roles and permissions - they're already created
    console.log('ℹ️ Skipping admin users, roles and permissions (already configured)');
    
    console.log(`✅ Essential data import completed!`);
    
    // Verify import by counting records
    console.log('\n🔍 Verifying import...');
    const supplierCount = await pool.query('SELECT COUNT(*) FROM suppliers');
    const categoryCount = await pool.query('SELECT COUNT(*) FROM categories');
    
    console.log(`📋 Database counts after import:`);
    console.log(`   - Suppliers: ${supplierCount.rows[0].count}`);
    console.log(`   - Categories: ${categoryCount.rows[0].count}`);
    
    // Show A113 supplier specifically
    const a113Supplier = await pool.query('SELECT * FROM suppliers WHERE code = $1', ['A113']);
    if (a113Supplier.rows.length > 0) {
      console.log(`✅ A113 supplier found: ${a113Supplier.rows[0].name}`);
    } else {
      console.log(`⚠️ A113 supplier not found`);
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

importEssentialData();