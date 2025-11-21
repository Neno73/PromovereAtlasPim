const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('GEMINI_API_KEY not found in .env');
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey });

async function run() {
    try {
        console.log('1. Creating/Finding File Search Store...');

        // Check if store exists
        const stores = await client.fileSearchStores.list();
        console.log('Stores structure:', Object.keys(stores));

        const storeList = stores.pageInternal || stores.fileSearchStores || stores;
        const STORE_NAME = 'PromoAtlas Product Catalog';
        let store = storeList.find(s => s.displayName === STORE_NAME);

        if (!store) {
            console.log('2. Creating new FileSearchStore...');
            store = await client.fileSearchStores.create({
                config: { displayName: STORE_NAME }
            });
            console.log('Created:', store.name);
        } else {
            console.log('2. Found existing store:', store.name);
        }

        const storeId = store.name;

        console.log('3. Creating test file...');
        const tempFile = path.join(__dirname, 'test-product.json');
        fs.writeFileSync(tempFile, JSON.stringify({
            sku: 'TEST-FINAL-001',
            name_en: 'Test Product for RAG',
            description_en: 'This is a test product to verify FileSearchStore upload'
        }, null, 2));

        console.log(`4. Uploading to FileSearchStore: ${storeId}`);
        console.log('Using parameter: fileSearchStoreName');

        let operation = await client.fileSearchStores.uploadToFileSearchStore({
            file: tempFile,
            fileSearchStoreName: storeId,  // Correct parameter name from docs
            config: {
                displayName: 'test-product.json',
            }
        });

        console.log('5. Waiting for operation to complete...');
        let attempts = 0;
        while (!operation.done && attempts < 20) {
            console.log(`   Attempt ${attempts + 1}/20...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            operation = await client.operations.get({ operation });
            attempts++;
        }

        if (operation.done) {
            console.log('✅ Upload completed!');
            console.log('Operation response:', JSON.stringify(operation.response, null, 2));
        } else {
            console.log('⚠️ Operation timed out');
        }

        fs.unlinkSync(tempFile);

    } catch (error) {
        console.error('❌ Error:', error);
        if (error.message) console.error('Message:', error.message);
    }
}

run();
