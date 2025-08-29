#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function exportEssentialData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('📦 Starting essential data export...');
    
    const exportData = {};
    
    // Export suppliers
    console.log('📋 Exporting suppliers...');
    const suppliersResult = await pool.query('SELECT * FROM suppliers ORDER BY id');
    exportData.suppliers = suppliersResult.rows;
    console.log(`✅ Exported ${exportData.suppliers.length} suppliers`);
    
    // Export categories
    console.log('📋 Exporting categories...');
    const categoriesResult = await pool.query('SELECT * FROM categories ORDER BY id');
    exportData.categories = categoriesResult.rows;
    console.log(`✅ Exported ${exportData.categories.length} categories`);
    
    // Export sync configurations
    console.log('📋 Exporting sync configurations...');
    const syncConfigsResult = await pool.query('SELECT * FROM sync_configurations ORDER BY id');
    exportData.sync_configurations = syncConfigsResult.rows;
    console.log(`✅ Exported ${exportData.sync_configurations.length} sync configurations`);
    
    // Export admin users
    console.log('📋 Exporting admin users...');
    const adminUsersResult = await pool.query('SELECT * FROM admin_users ORDER BY id');
    exportData.admin_users = adminUsersResult.rows;
    console.log(`✅ Exported ${exportData.admin_users.length} admin users`);
    
    // Export admin roles
    console.log('📋 Exporting admin roles...');
    const adminRolesResult = await pool.query('SELECT * FROM admin_roles ORDER BY id');
    exportData.admin_roles = adminRolesResult.rows;
    console.log(`✅ Exported ${exportData.admin_roles.length} admin roles`);
    
    // Export admin permissions
    console.log('📋 Exporting admin permissions...');
    const adminPermissionsResult = await pool.query('SELECT * FROM admin_permissions ORDER BY id');
    exportData.admin_permissions = adminPermissionsResult.rows;
    console.log(`✅ Exported ${exportData.admin_permissions.length} admin permissions`);
    
    // Export up_users (public users if any)
    console.log('📋 Exporting up_users...');
    try {
      const upUsersResult = await pool.query('SELECT * FROM up_users ORDER BY id');
      exportData.up_users = upUsersResult.rows;
      console.log(`✅ Exported ${exportData.up_users.length} public users`);
    } catch (error) {
      console.log('ℹ️ No up_users table found (normal for some configurations)');
      exportData.up_users = [];
    }
    
    // Export up_roles
    console.log('📋 Exporting up_roles...');
    try {
      const upRolesResult = await pool.query('SELECT * FROM up_roles ORDER BY id');
      exportData.up_roles = upRolesResult.rows;
      console.log(`✅ Exported ${exportData.up_roles.length} public roles`);
    } catch (error) {
      console.log('ℹ️ No up_roles table found (normal for some configurations)');
      exportData.up_roles = [];
    }
    
    // Export up_permissions
    console.log('📋 Exporting up_permissions...');
    try {
      const upPermissionsResult = await pool.query('SELECT * FROM up_permissions ORDER BY id');
      exportData.up_permissions = upPermissionsResult.rows;
      console.log(`✅ Exported ${exportData.up_permissions.length} public permissions`);
    } catch (error) {
      console.log('ℹ️ No up_permissions table found (normal for some configurations)');
      exportData.up_permissions = [];
    }
    
    // Add export metadata
    exportData.export_metadata = {
      exported_at: new Date().toISOString(),
      source_database: process.env.DATABASE_URL.split('@')[1].split('/')[0], // Extract host for identification
      version: '1.0.0'
    };
    
    // Save to file
    const exportPath = './essential-data-export.json';
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    
    console.log(`✅ Essential data export completed!`);
    console.log(`📄 Export saved to: ${exportPath}`);
    console.log(`📊 Export summary:`);
    console.log(`   - Suppliers: ${exportData.suppliers.length}`);
    console.log(`   - Categories: ${exportData.categories.length}`);
    console.log(`   - Sync Configs: ${exportData.sync_configurations.length}`);
    console.log(`   - Admin Users: ${exportData.admin_users.length}`);
    console.log(`   - Admin Roles: ${exportData.admin_roles.length}`);
    console.log(`   - Admin Permissions: ${exportData.admin_permissions.length}`);
    console.log(`   - Public Users: ${exportData.up_users.length}`);
    console.log(`   - Public Roles: ${exportData.up_roles.length}`);
    console.log(`   - Public Permissions: ${exportData.up_permissions.length}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

exportEssentialData();