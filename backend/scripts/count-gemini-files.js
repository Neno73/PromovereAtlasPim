require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function countFiles() {
    if (!process.env.GEMINI_API_KEY) {
        console.error('Error: GEMINI_API_KEY not found in environment');
        process.exit(1);
    }

    console.log('🔍 Connecting to Gemini API...');
    // Only pass apiKey. Passing project with apiKey causes "mutually exclusive" error.
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });

    try {
        console.log('📂 Listing files from Gemini...');
        const pager = await ai.files.list();

        let totalFiles = 0;
        let a389Count = 0;
        let examples = [];

        // Iterate through async iterable
        for await (const file of pager) {
            totalFiles++;
            const name = file.displayName || file.name || 'unknown';

            if (name.includes('A389') || name.includes('a389')) {
                a389Count++;
                if (examples.length < 5) {
                    examples.push(name);
                }
            }
        }

        console.log('\n📊 Results:');
        console.log(`   - Total Files in Project: ${totalFiles}`);
        console.log(`   - Files matching "A389": ${a389Count}`);

        if (examples.length > 0) {
            console.log('\n📝 Examples found:');
            examples.forEach(e => console.log(`   - ${e}`));
        } else {
            console.log('\n⚠️ No A389 files found. Checks logs for successful uploads.');
        }

    } catch (error) {
        console.error('❌ Error listing files:', error);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

countFiles();
