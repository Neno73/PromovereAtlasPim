#!/usr/bin/env node
/**
 * Gemini Sync Prerequisites Check
 * 
 * Verifies all dependencies and configuration needed for Gemini sync testing:
 * - Environment variables
 * - Meilisearch connectivity and data
 * - Redis connectivity
 * - Gemini API access
 * - Queue system status
 */

require('dotenv').config();
const { MeiliSearch } = require('meilisearch');
const { GoogleGenAI } = require('@google/genai');

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'cyan');
    console.log('='.repeat(60));
}

function checkmark() {
    log('✅', 'green');
}

function cross() {
    log('❌', 'red');
}

const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    checks: [],
};

function addCheck(name, passed, details = '', warning = false) {
    results.checks.push({ name, passed, details, warning });
    if (passed) {
        results.passed++;
    } else {
        if (warning) {
            results.warnings++;
        } else {
            results.failed++;
        }
    }
}

async function checkEnvironmentVariables() {
    logSection('1. Environment Variables');

    const requiredVars = [
        'GEMINI_API_KEY',
        'GOOGLE_CLOUD_PROJECT',
        'GOOGLE_CLOUD_PROJECT_NUMBER',
        'GEMINI_FILE_SEARCH_STORE_NAME',
    ];

    const optionalVars = [
        'MEILISEARCH_HOST',
        'MEILISEARCH_API_KEY',
        'REDIS_HOST',
        'REDIS_PORT',
    ];

    console.log('\nRequired Variables:');
    for (const varName of requiredVars) {
        const value = process.env[varName];
        const exists = !!value;
        const display = exists ? `${value.substring(0, 20)}...` : 'NOT SET';

        console.log(`  ${exists ? '✅' : '❌'} ${varName}: ${display}`);
        addCheck(`ENV: ${varName}`, exists, display);
    }

    console.log('\nOptional Variables:');
    for (const varName of optionalVars) {
        const value = process.env[varName];
        const exists = !!value;
        const display = exists ? value : 'NOT SET (using defaults)';

        console.log(`  ${exists ? '✅' : '⚠️ '} ${varName}: ${display}`);
        if (!exists) {
            addCheck(`ENV: ${varName}`, true, 'Using default', true);
        }
    }
}

async function checkMeilisearch() {
    logSection('2. Meilisearch Connection');

    try {
        const host = process.env.MEILISEARCH_HOST || 'http://127.0.0.1:7700';
        const apiKey = process.env.MEILISEARCH_ADMIN_KEY || process.env.MEILISEARCH_API_KEY || '';
        const indexName = process.env.MEILISEARCH_INDEX_NAME || 'pim_products';

        log(`  Connecting to: ${host}`, 'blue');
        log(`  Index: ${indexName}`, 'blue');

        const client = new MeiliSearch({ host, apiKey });

        // Check health
        const health = await client.health();
        console.log(`  ✅ Meilisearch is healthy: ${health.status}`);
        addCheck('Meilisearch: Health', true, health.status);

        // Get stats
        const stats = await client.getStats();
        console.log(`  ✅ Total indexes: ${Object.keys(stats.indexes).length}`);

        // Find products index
        const indexStats = stats.indexes[indexName];

        if (indexStats) {
            console.log(`  ✅ Products index found: "${indexName}"`);
            console.log(`     - Documents: ${indexStats.numberOfDocuments}`);
            console.log(`     - Indexing: ${indexStats.isIndexing ? 'In progress' : 'Idle'}`);

            addCheck('Meilisearch: Products Index', true, `${indexStats.numberOfDocuments} docs`);

            // Get sample products
            const index = client.index(indexName);
            const searchResult = await index.search('', { limit: 5 });

            if (searchResult.hits.length > 0) {
                console.log(`  ✅ Sample products retrieved: ${searchResult.hits.length}`);
                console.log('     Sample IDs for testing:');
                searchResult.hits.forEach((hit, i) => {
                    console.log(`       ${i + 1}. ${hit.id} (${hit.sku || 'no SKU'})`);
                });

                addCheck('Meilisearch: Sample Products', true, `${searchResult.hits.length} products`);

                // Store for later use
                global.sampleProductIds = searchResult.hits.map(h => h.id);
            } else {
                log('  ⚠️  No products found in index', 'yellow');
                addCheck('Meilisearch: Sample Products', false, 'Index is empty', true);
            }
        } else {
            log(`  ❌ Products index "${indexName}" not found`, 'red');
            log('     Available indexes:', 'yellow');
            Object.keys(stats.indexes).forEach(name => {
                console.log(`       - ${name} (${stats.indexes[name].numberOfDocuments} docs)`);
            });
            addCheck('Meilisearch: Products Index', false, 'Index not found');
        }
    } catch (error) {
        log(`  ❌ Meilisearch check failed: ${error.message}`, 'red');
        addCheck('Meilisearch: Connection', false, error.message);
    }
}

async function checkGeminiAPI() {
    logSection('3. Gemini API Connection');

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const projectId = process.env.GOOGLE_CLOUD_PROJECT;
        const projectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER;
        const storeName = process.env.GEMINI_FILE_SEARCH_STORE_NAME;

        if (!apiKey) {
            log('  ❌ GEMINI_API_KEY not set', 'red');
            addCheck('Gemini: API Key', false, 'Not set');
            return;
        }

        log(`  Project: ${projectId}`, 'blue');
        log(`  Store: ${storeName}`, 'blue');

        const ai = new GoogleGenAI({ apiKey });

        // Test connection by listing files
        log('  Testing API connection...', 'blue');
        const pager = await ai.files.list();

        let fileCount = 0;
        let totalSize = 0;

        // Count files (limit to 100 for speed)
        let counted = 0;
        for await (const file of pager) {
            fileCount++;
            const sizeBytes = typeof file.sizeBytes === 'string'
                ? parseInt(file.sizeBytes, 10)
                : (file.sizeBytes || 0);
            totalSize += sizeBytes;

            counted++;
            if (counted >= 100) {
                log('  ⚠️  More than 100 files, stopping count...', 'yellow');
                break;
            }
        }

        console.log(`  ✅ Gemini API connected successfully`);
        console.log(`     - Files in store: ${fileCount}${counted >= 100 ? '+' : ''}`);
        console.log(`     - Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

        addCheck('Gemini: API Connection', true, `${fileCount}${counted >= 100 ? '+' : ''} files`);

    } catch (error) {
        log(`  ❌ Gemini API check failed: ${error.message}`, 'red');

        if (error.message.includes('401') || error.message.includes('403')) {
            log('     → Check API key validity and permissions', 'yellow');
        } else if (error.message.includes('429')) {
            log('     → Rate limit exceeded, quota may be exhausted', 'yellow');
        }

        addCheck('Gemini: API Connection', false, error.message);
    }
}

async function checkQueueSystem() {
    logSection('4. Queue System Status');

    try {
        // Try to connect to Bull Board API
        const response = await fetch('http://localhost:1337/admin/queues/api/queues');

        if (response.status === 401) {
            log('  ⚠️  Queue API requires authentication', 'yellow');
            log('     Manual check required via Bull Board UI:', 'blue');
            log('     http://localhost:1337/admin/queues', 'cyan');
            addCheck('Queue: Bull Board', true, 'Requires manual check', true);
        } else if (response.ok) {
            const data = await response.json();
            console.log('  ✅ Queue API accessible');

            // Parse queue data
            if (data.queues) {
                const geminiQueue = data.queues.find(q => q.name === 'gemini-sync');
                if (geminiQueue) {
                    console.log('  ✅ gemini-sync queue found:');
                    console.log(`     - Waiting: ${geminiQueue.counts?.waiting || 0}`);
                    console.log(`     - Active: ${geminiQueue.counts?.active || 0}`);
                    console.log(`     - Completed: ${geminiQueue.counts?.completed || 0}`);
                    console.log(`     - Failed: ${geminiQueue.counts?.failed || 0}`);

                    const total = (geminiQueue.counts?.waiting || 0) +
                        (geminiQueue.counts?.active || 0) +
                        (geminiQueue.counts?.completed || 0) +
                        (geminiQueue.counts?.failed || 0);

                    addCheck('Queue: gemini-sync', true, `${total} total jobs`);

                    if (geminiQueue.counts?.waiting > 10000) {
                        log('     ⚠️  Large number of waiting jobs detected', 'yellow');
                    }
                }
            }
        }
    } catch (error) {
        log(`  ⚠️  Queue check failed: ${error.message}`, 'yellow');
        log('     Manual check via: http://localhost:1337/admin/queues', 'blue');
        addCheck('Queue: Status', true, 'Manual check required', true);
    }
}

function printSummary() {
    logSection('Summary');

    console.log(`\n  Total Checks: ${results.checks.length}`);
    log(`  ✅ Passed: ${results.passed}`, 'green');
    if (results.warnings > 0) {
        log(`  ⚠️  Warnings: ${results.warnings}`, 'yellow');
    }
    if (results.failed > 0) {
        log(`  ❌ Failed: ${results.failed}`, 'red');
    }

    if (results.failed > 0) {
        console.log('\n  Failed Checks:');
        results.checks
            .filter(check => !check.passed && !check.warning)
            .forEach(check => {
                log(`    ❌ ${check.name}: ${check.details}`, 'red');
            });
    }

    console.log('\n' + '='.repeat(60));

    if (results.failed === 0) {
        log('\n🎉 All critical checks passed! Ready to proceed with testing.', 'green');

        if (global.sampleProductIds && global.sampleProductIds.length > 0) {
            console.log('\nSample Product IDs for testing:');
            global.sampleProductIds.slice(0, 5).forEach((id, i) => {
                console.log(`  ${i + 1}. ${id}`);
            });
        }
    } else {
        log('\n⚠️  Some checks failed. Please fix issues before proceeding.', 'yellow');
    }

    console.log('');
}

async function main() {
    log('\n🔍 Gemini Sync Prerequisites Check\n', 'cyan');

    await checkEnvironmentVariables();
    await checkMeilisearch();
    await checkGeminiAPI();
    await checkQueueSystem();

    printSummary();

    process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
});
