#!/usr/bin/env node

const AWS = require('aws-sdk');
require('dotenv').config();

async function cleanR2Bucket() {
  try {
    console.log('🧹 Starting R2 bucket cleanup...');
    
    // Configure AWS SDK for Cloudflare R2
    const s3 = new AWS.S3({
      endpoint: process.env.R2_ENDPOINT,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      region: 'auto', // Cloudflare R2 uses 'auto'
      s3ForcePathStyle: true
    });
    
    const bucketName = process.env.R2_BUCKET_NAME;
    console.log(`📦 Bucket: ${bucketName}`);
    
    // List all objects in the bucket
    console.log('📋 Listing all objects in bucket...');
    const listParams = {
      Bucket: bucketName
    };
    
    let totalObjects = 0;
    let continuationToken = null;
    let allObjects = [];
    
    do {
      if (continuationToken) {
        listParams.ContinuationToken = continuationToken;
      }
      
      const listResult = await s3.listObjectsV2(listParams).promise();
      
      if (listResult.Contents && listResult.Contents.length > 0) {
        totalObjects += listResult.Contents.length;
        allObjects.push(...listResult.Contents);
        console.log(`📄 Found ${listResult.Contents.length} objects (total: ${totalObjects})`);
      }
      
      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);
    
    if (totalObjects === 0) {
      console.log('✅ Bucket is already empty');
      return;
    }
    
    console.log(`🗑️ Preparing to delete ${totalObjects} objects...`);
    
    // Delete objects in batches (max 1000 per batch for AWS S3 API)
    const batchSize = 1000;
    let deleted = 0;
    
    for (let i = 0; i < allObjects.length; i += batchSize) {
      const batch = allObjects.slice(i, i + batchSize);
      
      const deleteParams = {
        Bucket: bucketName,
        Delete: {
          Objects: batch.map(obj => ({ Key: obj.Key })),
          Quiet: false
        }
      };
      
      console.log(`🗑️ Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allObjects.length / batchSize)} (${batch.length} objects)...`);
      
      const deleteResult = await s3.deleteObjects(deleteParams).promise();
      
      if (deleteResult.Deleted) {
        deleted += deleteResult.Deleted.length;
        console.log(`✅ Deleted ${deleteResult.Deleted.length} objects (total: ${deleted}/${totalObjects})`);
      }
      
      if (deleteResult.Errors && deleteResult.Errors.length > 0) {
        console.error(`❌ Errors deleting ${deleteResult.Errors.length} objects:`, deleteResult.Errors);
      }
    }
    
    console.log(`✅ R2 bucket cleanup completed!`);
    console.log(`📊 Summary: Deleted ${deleted}/${totalObjects} objects`);
    
    // Verify bucket is empty
    const verifyResult = await s3.listObjectsV2({ Bucket: bucketName }).promise();
    const remaining = verifyResult.KeyCount || 0;
    
    if (remaining === 0) {
      console.log('🎉 Bucket is now completely empty!');
    } else {
      console.log(`⚠️ ${remaining} objects still remain in bucket`);
    }
    
  } catch (error) {
    console.error('❌ R2 cleanup failed:', error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    process.exit(1);
  }
}

cleanR2Bucket();