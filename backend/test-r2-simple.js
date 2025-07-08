const AWS = require('aws-sdk');
require('dotenv').config();

console.log('🔍 Testing Cloudflare R2 connection...');
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
  s3ForcePathStyle: true, // Important for R2
});

async function testR2() {
  try {
    console.log('\n📋 Attempting to create bucket (if it doesn\'t exist)...');
    await s3.createBucket({ Bucket: process.env.R2_BUCKET_NAME }).promise();
    console.log('✅ Bucket created or already exists');
    
    console.log('\n📤 Testing simple upload...');
    const result = await s3.upload({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: 'test.txt',
      Body: 'Hello R2!',
      ContentType: 'text/plain'
    }).promise();
    
    console.log('✅ Upload successful!');
    console.log('ETag:', result.ETag);
    console.log('Location:', result.Location);
    
    console.log('\n🎉 R2 connection is working!');
    
  } catch (error) {
    console.error('❌ R2 test failed:', error.message);
    console.error('Error code:', error.code);
    if (error.code === 'BucketAlreadyExists') {
      console.log('ℹ️  Bucket already exists - this is OK');
    }
  }
}

testR2();
