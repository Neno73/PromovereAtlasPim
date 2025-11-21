/**
 * Simple Gemini Upload Test
 * Tests uploading 5 mock products to Gemini Files API
 */

const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('GEMINI_API_KEY not found');
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey });

// Mock product data
const mockProducts = [
    { sku: 'TEST-001', name_en: 'Test Product 1', description_en: 'First test product' },
    { sku: 'TEST-002', name_en: 'Test Product 2', description_en: 'Second test product' },
    { sku: 'TEST-003', name_en: 'Test Product 3', description_en: 'Third test product' },
    { sku: 'TEST-004', name_en: 'Test Product 4', description_en: 'Fourth test product' },
    { sku: 'TEST-005', name_en: 'Test Product 5', description_en: 'Fifth test product' },
];

async function uploadProduct(product) {
    const fileName = `${product.sku}.json`;
    const tempFile = path.join(__dirname, fileName);

    try {
        // Write JSON
        fs.writeFileSync(tempFile, JSON.stringify(product, null, 2));

        // Upload
        const result = await client.files.upload({
            file: tempFile,
            config: {
                displayName: fileName,
                mimeType: 'application/json'
            }
        });

        // Result might be { file: {...} } or just {...}
        const file = result.file || result;
        console.log(`✅ ${product.sku}: ${file.name}`);

        // Cleanup
        fs.unlinkSync(tempFile);

        return file;

    } catch (error) {
        console.error(`❌ ${product.sku}:`, error.message);
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        return null;
    }
}

async function run() {
    console.log('🚀 Testing Gemini File Upload with 5 products...\n');

    const results = [];
    for (const product of mockProducts) {
        const file = await uploadProduct(product);
        if (file) results.push(file);
    }

    console.log(`\n✅ Successfully uploaded ${results.length}/${mockProducts.length} products`);
    console.log('\nFile URIs:');
    results.forEach(f => console.log(`  - ${f.displayName}: ${f.uri}`));
}

run().catch(console.error);
