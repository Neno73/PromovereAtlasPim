const { GoogleGenAI } = require('@google/genai');

try {
    const client = new GoogleGenAI({ apiKey: 'test' });
    if (client.fileSearchStores) {
        console.log('client.fileSearchStores methods:', Object.keys(client.fileSearchStores));
        console.log('client.fileSearchStores prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.fileSearchStores)));
    }
} catch (e) {
    console.error(e);
}
