/**
 * Database Migration: Add Performance Indexes for Promidata Sync
 *
 * This migration adds indexes to improve query performance during sync operations.
 * These indexes are critical for production performance when dealing with large datasets.
 *
 * Indexes added:
 * - products.a_number: Used for product family grouping
 * - products.sku: Used for unique product lookup
 * - products.promidata_hash: Used for incremental sync (hash comparison)
 * - products.supplier: Used for filtering by supplier
 * - product_variants.sku: Used for unique variant lookup
 * - product_variants.product: Used for finding variants by product (foreign key)
 *
 * ClaudeBot Feedback: PR #7 identified these indexes as HIGH PRIORITY
 * "Will be slow with large datasets" - database indexing missing
 */

module.exports = {
  /**
   * Run the migration
   */
  async up(knex) {
    // Add indexes to products table
    await knex.schema.table('products', (table) => {
      // Index for product family grouping (used in groupByANumber)
      table.index('a_number', 'idx_products_a_number');

      // Index for SKU lookup (used in findBySku, deduplication)
      table.index('sku', 'idx_products_sku');

      // Index for hash-based incremental sync (used in filterProductsNeedingSync)
      table.index('promidata_hash', 'idx_products_promidata_hash');

      // Index for supplier filtering (used in findBySupplier queries)
      table.index('supplier', 'idx_products_supplier');
    });

    // Add indexes to product_variants table
    await knex.schema.table('product_variants', (table) => {
      // Index for SKU lookup (used in findBySku)
      table.index('sku', 'idx_product_variants_sku');

      // Index for finding variants by product (foreign key, used frequently)
      table.index('product', 'idx_product_variants_product');

      // Composite index for color filtering within a product
      table.index(['product', 'color'], 'idx_product_variants_product_color');

      // Index for finding primary variants per color
      table.index(['product', 'is_primary_for_color'], 'idx_product_variants_primary');
    });

    console.log('✅ Database indexes created successfully');
  },

  /**
   * Rollback the migration
   */
  async down(knex) {
    // Drop indexes from product_variants table
    await knex.schema.table('product_variants', (table) => {
      table.dropIndex('is_primary_for_color', 'idx_product_variants_primary');
      table.dropIndex(['product', 'color'], 'idx_product_variants_product_color');
      table.dropIndex('product', 'idx_product_variants_product');
      table.dropIndex('sku', 'idx_product_variants_sku');
    });

    // Drop indexes from products table
    await knex.schema.table('products', (table) => {
      table.dropIndex('supplier', 'idx_products_supplier');
      table.dropIndex('promidata_hash', 'idx_products_promidata_hash');
      table.dropIndex('sku', 'idx_products_sku');
      table.dropIndex('a_number', 'idx_products_a_number');
    });

    console.log('✅ Database indexes dropped successfully');
  }
};
