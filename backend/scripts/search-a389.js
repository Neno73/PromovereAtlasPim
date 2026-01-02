#!/usr/bin/env node
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const STORE_ID = 'fileSearchStores/promoatlas-product-catalog-xfex8hxfyifx';

async function searchA389() {
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('API Key:', apiKey ? apiKey.substring(0,5) + '...' : 'MISSING');
    console.log('Store ID:', STORE_ID);

    if (!apiKey) {
        console.log('Missing GEMINI_API_KEY');
        return;
    }

    const client = new GoogleGenAI({ apiKey });

    console.log('\n🔍 Searching for A389 products...\n');

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: 'Find products from supplier A389 or Stedman. List any product SKUs that start with A389.',
            config: {
                tools: [{
                    fileSearch: {
                        fileSearchStoreNames: [STORE_ID]
                    }
                }]
            }
        });

        console.log('Response:', response.text);
    } catch (e) {
        console.error('Error:', e.message);
        console.log('\nTrying alternative approach with grounding...');

        // Try without fileSearch to test basic connectivity
        const response2 = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: 'What products with SKU A389-STE9700 do you know about?'
        });
        console.log('Basic response:', response2.text);
    }
}

searchA389().catch(e => console.error('Fatal Error:', e.message));
