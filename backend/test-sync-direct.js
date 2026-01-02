/**
 * Simple test: Sync 5 products directly
 * Bypasses BullMQ/Redis to avoid connection issues
 */

const { GoogleGenAI } = require('@google/genai');
const pg = require('pg');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

// Load transformer
const productToJson = require('./dist/src/services/gemini/transformers/product-to-json').default;

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('GEMINI_API_KEY not found');
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey });

async function getOrCreateStore() {
    const stores = await client.fileSearchStores.list();
    const storeList = stores.pageInternal || stores.fileSearchStores || stores;
    const STORE_NAME = 'PromoAtlas Product Catalog';
    let store = storeList.find(s => s.displayName === STORE_NAME);

    if (!store) {
        store = await client.fileSearchStores.create({
            config: { displayName: STORE_NAME }
        });
    }

    return store.name;
}

async function uploadProduct(product, storeId) {
    // Transform to JSON
    const productDoc = productToJson.transform(product);
    const jsonContent = JSON.stringify(productDoc, null, 2);
    const fileName = `${productDoc.sku}.json`;

    // Write temp file
    const tempFile = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tempFile, jsonContent);

    try {
        // Upload
        let operation = await client.fileSearchStores.uploadToFileSearchStore({
            file: tempFile,
            fileSearchStoreName: storeId,
            config: { displayName: fileName }
        });

        // Wait for completion
        let attempts = 0;
        while (!operation.done && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            operation = await client.operations.get({ operation });
            attempts++;
        }

        fs.unlinkSync(tempFile);

        if (operation.done) {
            return operation.response;
        } else {
            throw new Error('Upload timed out');
        }
    } catch (error) {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        throw error;
    }
}

async function run() {
    try {
        console.log('🚀 Connecting to database...');
        const dbClient = new pg.Client({
            connectionString: process.env.DATABASE_URL
        });
        await dbClient.connect();
        console.log('✅ Connected\n');

        console.log('📦 Fetching 50 products...');
        const result = await dbClient.query(`
            SELECT id, document_id, sku, a_number, name, description, brand
            FROM products 
            LIMIT 50
        `);

        const products = result.rows;
        console.log(`Found ${products.length} products\n`);

        console.log('🔧 Getting FileSearchStore...');
        const storeId = await getOrCreateStore();
        console.log(`Store: ${storeId}\n`);

        let successCount = 0;
        for (const product of products) {
            try {
                console.log(`🔄 Syncing: ${product.sku}...`);
                const response = await uploadProduct(product, storeId);
                console.log(`   ✅ ${response.documentName}`);
                successCount++;
            } catch (err) {
                console.error(`   ❌ Error: ${err.message}`);
            }
        }

        console.log(`\n✅ Complete: ${successCount}/${products.length} synced`);

        await dbClient.end();
        process.exit(0);

    } catch (error) {
        console.error('❌ Fatal Error:', error);
        process.exit(1);
    }
}

run();
