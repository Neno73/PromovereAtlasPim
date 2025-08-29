#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function fixCategories() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔧 Starting category relationship fixes...');
    
    // Read export data
    const exportData = JSON.parse(fs.readFileSync('./essential-data-export.json', 'utf8'));
    console.log(`📄 Found ${exportData.categories.length} categories in export`);
    
    // Clear existing categories first
    await pool.query('DELETE FROM categories');
    console.log('🗑️ Cleared existing categories');
    
    // First pass: Create all categories without relationships
    const categoryMap = new Map(); // code -> category data
    
    for (const category of exportData.categories) {
      categoryMap.set(category.code, category);
      
      const insertQuery = `
        INSERT INTO categories (
          document_id, code, name, sort_order, created_at, updated_at, 
          published_at, created_by_id, updated_by_id, locale
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      
      await pool.query(insertQuery, [
        category.document_id, 
        category.code, 
        JSON.stringify(category.name), // Keep as JSON
        category.sort_order,
        category.created_at, 
        category.updated_at, 
        category.published_at,
        category.created_by_id, 
        category.updated_by_id, 
        category.locale
      ]);
    }
    
    console.log(`✅ Created ${exportData.categories.length} categories`);
    
    // Second pass: Establish parent-child relationships
    let relationshipsCreated = 0;
    
    for (const category of exportData.categories) {
      // Check if category name indicates it's a child (contains "/")
      const englishName = category.name.en;
      if (englishName && englishName.includes('/')) {
        // Find parent based on name structure
        const parentName = englishName.split('/')[0]; // e.g., "Bags & Luggage" from "Bags & Luggage/Backpacks"
        
        // Find parent category by matching the beginning of English name
        const parentCategory = exportData.categories.find(cat => 
          cat.name.en === parentName && cat.code !== category.code
        );
        
        if (parentCategory) {
          // Get database IDs for both categories
          const childResult = await pool.query('SELECT id FROM categories WHERE code = $1', [category.code]);
          const parentResult = await pool.query('SELECT id FROM categories WHERE code = $1', [parentCategory.code]);
          
          if (childResult.rows.length > 0 && parentResult.rows.length > 0) {
            const childId = childResult.rows[0].id;
            const parentId = parentResult.rows[0].id;
            
            // Create parent-child relationship
            await pool.query(`
              INSERT INTO categories_parent_lnk (category_id, inv_category_id, category_ord) 
              VALUES ($1, $2, $3)
            `, [childId, parentId, 1]);
            
            relationshipsCreated++;
            console.log(`🔗 Linked ${category.code} -> ${parentCategory.code}`);
          }
        }
      }
    }
    
    console.log(`✅ Created ${relationshipsCreated} parent-child relationships`);
    
    // Verify results
    const totalCount = await pool.query('SELECT COUNT(*) FROM categories');
    const withParentCount = await pool.query('SELECT COUNT(*) FROM categories c JOIN categories_parent_lnk l ON c.id = l.category_id');
    const parentCount = await pool.query('SELECT COUNT(DISTINCT inv_category_id) FROM categories_parent_lnk');
    
    console.log(`📊 Results:`);
    console.log(`   - Total categories: ${totalCount.rows[0].count}`);
    console.log(`   - Categories with parents: ${withParentCount.rows[0].count}`);
    console.log(`   - Parent categories: ${parentCount.rows[0].count}`);
    console.log(`   - Root categories: ${totalCount.rows[0].count - withParentCount.rows[0].count}`);
    
    // Show some examples
    console.log('\n📋 Sample categories with relationships:');
    const sampleQuery = `
      SELECT 
        c.code,
        c.name->>'en' as name,
        p.code as parent_code,
        p.name->>'en' as parent_name
      FROM categories c
      LEFT JOIN categories_parent_lnk l ON c.id = l.category_id
      LEFT JOIN categories p ON l.inv_category_id = p.id
      ORDER BY c.sort_order
      LIMIT 10
    `;
    
    const samples = await pool.query(sampleQuery);
    samples.rows.forEach(row => {
      if (row.parent_code) {
        console.log(`   ${row.code}: "${row.name}" (parent: ${row.parent_code})`);
      } else {
        console.log(`   ${row.code}: "${row.name}" (root category)`);
      }
    });
    
  } catch (error) {
    console.error('❌ Category fix failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixCategories();