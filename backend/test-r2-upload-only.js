const AWS = require('aws-sdk');
require('dotenv').config();

console.log('🔍 Testing R2 upload to existing bucket...');
console.log('Endpoint:', process.env.R2_ENDPOINT);
console.log('Access Key ID:', process.env.R2_ACCESS_KEY_ID?.substring(0, 8) + '...');
console.log('Bucket:', process.env.R2_BUCKET_NAME);

// Configure AWS SDK for Cloudflare R2
const s3 = new AWS.S3({
  endpoint: process.env.R2_ENDPOINT,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  region: 'auto',
  signatureVersion: 'v4',
  s3ForcePathStyle: true,
});

async function testR2Upload() {
  try {
    console.log('\n📤 Testing upload to existing bucket...');
    
    // Just upload directly - bucket already exists
    const result = await s3.upload({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: 'test/promoatlas-success.txt',
      Body: `PromoAtlas PIM System - R2 Test Success! ${new Date().toISOString()}`,
      ContentType: 'text/plain'
    }).promise();
    
    console.log('✅ Upload successful!');
    console.log('Location:', result.Location);
    console.log('ETag:', result.ETag);
    
    // Test download
    console.log('\n📥 Testing download...');
    const downloadResult = await s3.getObject({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: 'test/promoatlas-success.txt'
    }).promise();
    
    console.log('✅ Download successful!');
    console.log('Content:', downloadResult.Body.toString());
    
    console.log('\n🎉 R2 is working perfectly!');
    
  } catch (error) {
    console.error('❌ R2 test failed:', error.message);
    console.error('Error code:', error.code);
  }
}

testR2Upload();
