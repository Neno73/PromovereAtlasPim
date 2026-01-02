#!/usr/bin/env node
/**
 * Gemini FileSearchStore Verification Script
 *
 * Verifies whether files are actually in the FileSearchStore
 * by discovering the store the same way the service does.
 */

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

// This must match the constant in gemini-file-search.ts
const STORE_DISPLAY_NAME = 'PromoAtlas Product Catalog';

async function verify() {
    if (!process.env.GEMINI_API_KEY) {
        console.error('Error: GEMINI_API_KEY not found in environment');
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    console.log('🔍 Gemini FileSearchStore Verification\n');
    console.log(`Looking for store with displayName: "${STORE_DISPLAY_NAME}"\n`);

    // Test 1: files.list() - should return 0 (wrong namespace)
    console.log('═'.repeat(50));
    console.log('TEST 1: files.list() (default namespace)');
    console.log('═'.repeat(50));

    let defaultCount = 0;
    try {
        const pager = await ai.files.list();
        for await (const file of pager) {
            defaultCount++;
            if (defaultCount <= 3) {
                console.log(`  Found: ${file.displayName || file.name}`);
            }
        }
        console.log(`\nResult: ${defaultCount} files`);
        console.log(`Expected: 0 (files are in FileSearchStore, not here)\n`);
    } catch (e) {
        console.log(`Error: ${e.message}\n`);
    }

    // Test 2: Find all FileSearchStores with matching displayName
    console.log('═'.repeat(50));
    console.log('TEST 2: Find ALL FileSearchStores');
    console.log('═'.repeat(50));

    let matchingStores = [];
    let allStores = [];

    try {
        console.log('Listing all FileSearchStores...\n');
        const storesPager = await ai.fileSearchStores.list();

        for await (const store of storesPager) {
            allStores.push(store);
            console.log(`  Found store: "${store.displayName || '(no name)'}"`);
            console.log(`    - ID: ${store.name}`);
            console.log(`    - Created: ${store.createTime || 'unknown'}`);
            console.log('');

            if (store.displayName === STORE_DISPLAY_NAME) {
                matchingStores.push(store);
            }
        }

        if (allStores.length === 0) {
            console.log('  No FileSearchStores found in this project!\n');
        }

        if (matchingStores.length > 1) {
            console.log(`⚠️  WARNING: ${matchingStores.length} stores with same displayName!`);
            console.log(`   Service uses FIRST one found, but files may be in another.\n`);
        } else if (matchingStores.length === 1) {
            console.log(`✅ Found target store: ${matchingStores[0].name}\n`);
        } else {
            console.log(`⚠️  No store with displayName "${STORE_DISPLAY_NAME}" found\n`);
        }
    } catch (e) {
        console.log(`Error listing stores: ${e.message}\n`);
    }

    // Test 3: Query ALL matching stores to find files
    console.log('═'.repeat(50));
    console.log('TEST 3: Semantic search on ALL matching stores');
    console.log('═'.repeat(50));

    if (matchingStores.length === 0) {
        console.log('⚠️  No stores to query\n');
    } else {
        for (const store of matchingStores) {
            console.log(`\nQuerying: ${store.name}`);
            console.log(`Created: ${store.createTime}`);
            console.log('-'.repeat(40));

            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: [{
                        role: 'user',
                        parts: [{
                            text: 'List 3 product SKUs from the product catalog. Format: "SKU: name". If empty, say "EMPTY".'
                        }]
                    }],
                    tools: [{
                        fileSearch: {
                            fileSearchStoreIds: [store.name]
                        }
                    }]
                });

                const text = response.response?.candidates?.[0]?.content?.parts?.[0]?.text
                          || response.candidates?.[0]?.content?.parts?.[0]?.text
                          || 'No response';

                console.log(text.substring(0, 500));

                if (!text.includes('EMPTY') && !text.includes('need access') && !text.includes('Please provide')) {
                    console.log('\n✅ THIS STORE HAS FILES!');
                    console.log(`   Store ID: ${store.name}`);
                } else {
                    console.log('\n❌ Store appears empty');
                }
            } catch (e) {
                console.log(`Error: ${e.message}`);
            }
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('DIAGNOSIS');
    console.log('═'.repeat(50));

    if (matchingStores.length > 1) {
        console.log(`
⚠️  MULTIPLE STORES WITH SAME NAME

Found ${matchingStores.length} stores named "${STORE_DISPLAY_NAME}":
${matchingStores.map(s => `  - ${s.name} (${s.createTime})`).join('\n')}

PROBLEM: The service uses the FIRST store found during listing.
Each time the service restarted, it may have found a different one.
Files are scattered across stores!

SOLUTION OPTIONS:
1. Delete extra stores, keep only one
2. Merge files into one store
3. Update service to use explicit store ID
`);
    } else if (matchingStores.length === 1) {
        console.log(`
Single store found: ${matchingStores[0].name}

If Test 3 found products:
  → Files ARE correctly uploaded to FileSearchStore
  → Fix: Update getStats() and deleteDocument() to use FileSearchStore APIs

If Test 3 found EMPTY:
  → Files not uploading successfully
  → Fix: Add operation polling (wait for operation.done)
`);
    }
}

verify().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error);
    process.exit(1);
});
