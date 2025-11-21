const { GoogleGenAI } = require('@google/genai');

try {
    const client = new GoogleGenAI({ apiKey: 'test' });
    console.log('client.files.upload:', typeof client.files.upload);
    console.log('client.files.create:', typeof client.files.create);
    console.log('client.files.delete:', typeof client.files.delete);
    console.log('client.files.list:', typeof client.files.list);
} catch (e) {
    console.error(e);
}
