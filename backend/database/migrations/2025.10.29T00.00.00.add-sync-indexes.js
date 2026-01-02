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
    // Check if indexes already exist before creating them
    const hasANumberIndex = await knex.schema.hasColumn('products', 'a_number');
    const hasSkuIndex = await knex.schema.hasColumn('products', 'sku');
    const hasHashIndex = await knex.schema.hasColumn('products', 'promidata_hash');
    const hasSupplierIdColumn = await knex.schema.hasColumn('products', 'supplier_id');

    // Add indexes to products table only if columns exist
    await knex.schema.table('products', (table) => {
      // Index for product family grouping (used in groupByANumber)
      if (hasANumberIndex) {
        table.index('a_number', 'idx_products_a_number');
      }

      // Index for SKU lookup (used in findBySku, deduplication)
      if (hasSkuIndex) {
        table.index('sku', 'idx_products_sku');
      }

      // Index for hash-based incremental sync (used in filterProductsNeedingSync)
      if (hasHashIndex) {
        table.index('promidata_hash', 'idx_products_promidata_hash');
      }

      // Index for supplier filtering (used in findBySupplier queries)
      // Note: supplier is a relation, so Strapi creates supplier_id column
      if (hasSupplierIdColumn) {
        table.index('supplier_id', 'idx_products_supplier_id');
      }
    });

    // Check if product_variants table and columns exist
    const hasVariantsTable = await knex.schema.hasTable('product_variants');

    if (hasVariantsTable) {
      const hasVariantSku = await knex.schema.hasColumn('product_variants', 'sku');
      const hasVariantProduct = await knex.schema.hasColumn('product_variants', 'product_id');
      const hasVariantColor = await knex.schema.hasColumn('product_variants', 'color');
      const hasVariantPrimary = await knex.schema.hasColumn('product_variants', 'is_primary_for_color');

      // Add indexes to product_variants table only if columns exist
      await knex.schema.table('product_variants', (table) => {
        // Index for SKU lookup (used in findBySku)
        if (hasVariantSku) {
          table.index('sku', 'idx_product_variants_sku');
        }

        // Index for finding variants by product (foreign key, used frequently)
        // Note: product is a relation, so Strapi creates product_id column
        if (hasVariantProduct) {
          table.index('product_id', 'idx_product_variants_product_id');
        }

        // Composite index for color filtering within a product
        if (hasVariantProduct && hasVariantColor) {
          table.index(['product_id', 'color'], 'idx_product_variants_product_color');
        }

        // Index for finding primary variants per color
        if (hasVariantProduct && hasVariantPrimary) {
          table.index(['product_id', 'is_primary_for_color'], 'idx_product_variants_primary');
        }
      });
    }

    console.log('✅ Database indexes created successfully');
  },

  /**
   * Rollback the migration
   */
  async down(knex) {
    // Drop indexes from product_variants table (using correct column names)
    const hasVariantsTable = await knex.schema.hasTable('product_variants');

    if (hasVariantsTable) {
      await knex.schema.table('product_variants', (table) => {
        // Note: product is a relation, so the column is product_id
        table.dropIndex(['product_id', 'is_primary_for_color'], 'idx_product_variants_primary');
        table.dropIndex(['product_id', 'color'], 'idx_product_variants_product_color');
        table.dropIndex('product_id', 'idx_product_variants_product_id');
        table.dropIndex('sku', 'idx_product_variants_sku');
      });
    }

    // Drop indexes from products table (using correct column names)
    await knex.schema.table('products', (table) => {
      // Note: supplier is a relation, so the column is supplier_id
      table.dropIndex('supplier_id', 'idx_products_supplier_id');
      table.dropIndex('promidata_hash', 'idx_products_promidata_hash');
      table.dropIndex('sku', 'idx_products_sku');
      table.dropIndex('a_number', 'idx_products_a_number');
    });

    console.log('✅ Database indexes dropped successfully');
  }
};
