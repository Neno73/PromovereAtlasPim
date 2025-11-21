const { GoogleGenAI } = require('@google/genai');

try {
    const client = new GoogleGenAI({ apiKey: 'test' });
    console.log('client.corpora:', !!client.corpora);
    console.log('client.retrievers:', !!client.retrievers);
    // Sometimes it's under a specific namespace
    console.log('client.files:', !!client.files);

    // Check prototype or keys if possible
    console.log('Client keys:', Object.keys(client));
} catch (e) {
    console.error(e);
}
