/**
 * Meilisearch Re-indexing Script
 * 
 * Indexes 10-50 products from Strapi to Meilisearch
 * Creates indexes: promoatlas_products, promoatlas_product_variants
 */

const { MeiliSearch } = require('meilisearch');
const pg = require('pg');
require('dotenv').config();

const PRODUCT_LIMIT = parseInt(process.env.REINDEX_LIMIT || '10');

const meilisearchClient = new MeiliSearch({
  host: 'https://search.sols.mk',
  apiKey: '9abe8ab8d2b01b42cc32a7ad6055a5e4520533ce379348d3fd770e307cb54054'
});

async function reindexProducts() {
  try {
    console.log(`🚀 Re-indexing ${PRODUCT_LIMIT} products to Meilisearch...\n`);

    // 1. Connect to database
    console.log('📦 Connecting to database...');
    const dbClient = new pg.Client({
      connectionString: process.env.DATABASE_URL
    });
    await dbClient.connect();
    console.log('✅ Connected\n');

    // 2. Delete old indexes if they exist
    console.log('🗑️  Clearing old indexes...');
    try {
      await meilisearchClient.deleteIndex('promoatlas_products');
      console.log('   Deleted: promoatlas_products');
    } catch (e) {
      console.log('   promoatlas_products not found (ok)');
    }

    try {
      await meilisearchClient.deleteIndex('promoatlas_product_variants');
      console.log('   Deleted: promoatlas_product_variants');
    } catch (e) {
      console.log('   promoatlas_product_variants not found (ok)');
    }
    console.log('');

    // 3. Create indexes
    console.log('🔨 Creating indexes...');
    const productsIndex = meilisearchClient.index('promoatlas_products');
    const variantsIndex = meilisearchClient.index('promoatlas_product_variants');

    await meilisearchClient.createIndex('promoatlas_products', { primaryKey: 'id' });
    await meilisearchClient.createIndex('promoatlas_product_variants', { primaryKey: 'id' });
    console.log('✅ Indexes created\n');

    // 4. Fetch products
    console.log(`📊 Fetching ${PRODUCT_LIMIT} products...`);
    const productsResult = await dbClient.query(`
      SELECT 
        p.id,
        p.document_id,
        p.sku,
        p.a_number,
        p.name,
        p.description,
        p.short_description,
        p.brand,
        p.supplier_name,
        p.available_colors,
        p.available_sizes,
        p.hex_colors,
        p.price_min,
        p.price_max,
        p.main_image,
        p.category,
        p.updated_at
      FROM products p
      WHERE p.is_active = true
      LIMIT $1
    `, [PRODUCT_LIMIT]);

    const products = productsResult.rows;
    console.log(`✅ Found ${products.length} products\n`);

    // 5. Transform and index products
    console.log('🔄 Indexing products...');
    const transformedProducts = products.map(p => ({
      id: p.document_id,
      sku: p.sku,
      a_number: p.a_number,
      name_en: p.name?.en || '',
      name_de: p.name?.de || '',
      name_fr: p.name?.fr || '',
      name_es: p.name?.es || '',
      description_en: p.description?.en || '',
      description_de: p.description?.de || '',
      short_description_en: p.short_description?.en || '',
      brand: p.brand || '',
      supplier_name: p.supplier_name || '',
      category: p.category || '',
      colors: p.available_colors || [],
      sizes: p.available_sizes || [],
      hex_colors: p.hex_colors || [],
      price_min: parseFloat(p.price_min) || 0,
      price_max: parseFloat(p.price_max) || 0,
      main_image_url: p.main_image || '',
      updated_at: p.updated_at
    }));

    const productTask = await productsIndex.addDocuments(transformedProducts);
    console.log(`   Task ID: ${productTask.taskUid}`);

    // Wait for indexing to complete
    await productsIndex.waitForTask(productTask.taskUid);
    console.log('✅ Products indexed\n');

    // 6. Configure searchable attributes
    console.log('⚙️  Configuring search settings...');
    await productsIndex.updateSearchableAttributes([
      'name_en', 'name_de', 'name_fr', 'name_es',
      'description_en', 'description_de',
      'short_description_en',
      'sku', 'a_number', 'brand', 'category'
    ]);

    await productsIndex.updateFilterableAttributes([
      'category', 'brand', 'supplier_name',
      'colors', 'sizes', 'price_min', 'price_max'
    ]);

    await productsIndex.updateSortableAttributes([
      'price_min', 'updated_at'
    ]);

    console.log('✅ Settings configured\n');

    // 7. Test search
    console.log('🧪 Testing search...');
    const searchResult = await productsIndex.search('', { limit: 5 });
    console.log(`   Found ${searchResult.hits.length} products in index`);
    console.log(`   Sample: ${searchResult.hits[0]?.name_en || 'N/A'}\n`);

    await dbClient.end();

    console.log('🎉 Re-indexing complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   Products indexed: ${products.length}`);
    console.log(`   Index name: promoatlas_products`);
    console.log(`   Searchable: ✅`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

reindexProducts();
