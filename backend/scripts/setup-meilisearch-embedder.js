#!/usr/bin/env node
/**
 * Setup MeiliSearch Hybrid Search Embedder
 *
 * Configures the OpenAI text-embedding-3-small embedder on the pim_products index.
 * Run this once after setting up a fresh MeiliSearch instance.
 *
 * Requirements:
 * - MeiliSearch v1.6+ running
 * - OPENAI_API_KEY in .env
 * - MEILISEARCH_HOST and MEILISEARCH_ADMIN_KEY in .env
 *
 * Usage: node scripts/setup-meilisearch-embedder.js
 */

require('dotenv').config();

const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST || 'http://localhost:7700';
const MEILISEARCH_KEY = process.env.MEILISEARCH_ADMIN_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const INDEX_NAME = process.env.MEILISEARCH_INDEX_NAME || 'pim_products';

async function setup() {
  console.log('🔍 Setting up MeiliSearch hybrid search embedder...\n');

  // Validate
  if (!OPENAI_KEY) {
    console.error('❌ OPENAI_API_KEY not set in .env');
    process.exit(1);
  }

  // Check MeiliSearch version
  const versionRes = await fetch(`${MEILISEARCH_HOST}/version`, {
    headers: { 'Authorization': `Bearer ${MEILISEARCH_KEY}` }
  });
  const version = await versionRes.json();
  console.log(`MeiliSearch version: ${version.pkgVersion}`);

  const [major, minor] = version.pkgVersion.split('.').map(Number);
  if (major < 1 || (major === 1 && minor < 6)) {
    console.error('❌ MeiliSearch v1.6+ required for hybrid search');
    process.exit(1);
  }

  // Configure embedder
  console.log(`\nConfiguring embedder on index "${INDEX_NAME}"...`);

  const res = await fetch(`${MEILISEARCH_HOST}/indexes/${INDEX_NAME}/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILISEARCH_KEY}`,
    },
    body: JSON.stringify({
      embedders: {
        product_search: {
          source: 'openAi',
          apiKey: OPENAI_KEY,
          model: 'text-embedding-3-small',
          dimensions: 1536,
          documentTemplate: [
            'Product: {% if doc.name_en %}{{ doc.name_en }}{% elsif doc.name_de %}{{ doc.name_de }}{% elsif doc.name_fr %}{{ doc.name_fr }}{% else %}Unknown{% endif %}.',
            'Brand: {{ doc.brand }}. Category: {{ doc.category }}.',
            '{% if doc.description_en %}{{ doc.description_en | truncatewords: 30 }}{% elsif doc.description_de %}{{ doc.description_de | truncatewords: 30 }}{% endif %}',
            'Colors: {{ doc.colors | join: ", " }}. Supplier: {{ doc.supplier_name }}.',
          ].join(' '),
          documentTemplateMaxBytes: 800,
        },
      },
    }),
  });

  const result = await res.json();

  if (result.taskUid !== undefined) {
    console.log(`✅ Embedder configuration enqueued (task: ${result.taskUid})`);

    // Wait for task to complete
    let status = 'enqueued';
    while (status !== 'succeeded' && status !== 'failed') {
      await new Promise(r => setTimeout(r, 1000));
      const taskRes = await fetch(`${MEILISEARCH_HOST}/tasks/${result.taskUid}`, {
        headers: { 'Authorization': `Bearer ${MEILISEARCH_KEY}` }
      });
      const task = await taskRes.json();
      status = task.status;
    }

    if (status === 'succeeded') {
      console.log('✅ Embedder configured successfully!');
      console.log('\nNext steps:');
      console.log('  1. Run: node scripts/reindex-meilisearch.js');
      console.log('  2. Embeddings will be generated automatically for all products');
      console.log('  3. Search with: ?q=your+query&semantic=0.5');
    } else {
      console.error('❌ Embedder configuration failed');
    }
  } else {
    console.error('❌ Unexpected response:', result);
  }
}

setup().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
