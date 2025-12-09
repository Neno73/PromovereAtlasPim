#!/usr/bin/env node
/**
 * Manual Meilisearch Reindex Script
 * 
 * Directly fetches products from Strapi database and indexes them to Meilisearch.
 * Use this when the API endpoint is not available or accessible.
 */

require('dotenv').config();
const { MeiliSearch } = require('meilisearch');
const Strapi = require('@strapi/strapi');

async function reindex() {
  console.log('🚀 Starting manual Meilisearch reindex...\n');

  // Initialize Strapi
  console.log('1. Initializing Strapi...');
  const strapi = await Strapi();
  await strapi.load();

  console.log('✅ Strapi loaded\n');

  // Initialize Meilisearch
  console.log('2. Connecting to Meilisearch...');
  const meilisearch = new MeiliSearch({
    host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
    apiKey: process.env.MEILISEARCH_ADMIN_KEY || '',
  });

  const index = meilisearch.index('pim_products');
  const info = await index.getRawInfo();
  console.log('✅ Connected to Meilisearch');
  console.log('   Primary Key:', info.primaryKey);
  console.log('   Current docs:', info.numberOfDocuments || 0);
  console.log('');

  // Get Meilisearch service from Strapi
  console.log('3. Fetching products from Strapi...');
  const products = await strapi.db.query('api::product.product').findMany({
    populate: ['supplier', 'categories', 'main_image', 'price_tiers', 'dimensions'],
    where: { is_active: true },
  });

  console.log(`✅ Found ${products.length} active products\n`);

  // Use Strapi's Meilisearch service to transform and index
  console.log('4. Indexing products to Meilisearch...');
  const meilisearchService = strapi.service('api::product.meilisearch');
  await meilisearchService.initializeIndex();

  const stats = await meilisearchService.bulkAddOrUpdateDocuments(products, 100);

  console.log('\n✅ Reindex complete!');
  console.log(`   Total: ${stats.totalDocuments}`);
  console.log(`   Indexed: ${stats.indexedDocuments}`);
  console.log(`   Failed: ${stats.failedDocuments}`);
  console.log(`   Time: ${(stats.processingTimeMs / 1000).toFixed(2)}s`);

  if (stats.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    stats.errors.forEach(err => {
      console.log(`   - ${err.documentId}: ${err.error}`);
    });
  }

  await strapi.destroy();
  process.exit(0);
}

reindex().catch(error => {
  console.error('\n❌ Reindex failed:', error);
  process.exit(1);
});
