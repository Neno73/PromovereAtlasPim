#!/usr/bin/env node

const axios = require('axios');

async function cleanA113Sync() {
  try {
    console.log('🧹 Starting clean A113 sync...');
    
    // Wait for backend to be ready
    let backendReady = false;
    for (let i = 0; i < 30; i++) {
      try {
        const response = await axios.get('http://localhost:1337/api/suppliers', { timeout: 2000 });
        if (response.status === 200) {
          backendReady = true;
          console.log('✅ Backend is ready');
          break;
        }
      } catch (error) {
        console.log(`⏳ Waiting for backend... (${i + 1}/30)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!backendReady) {
      throw new Error('Backend not responding after 60 seconds');
    }
    
    // Start sync for A113 supplier specifically
    console.log('🚀 Starting A113 sync...');
    const syncResponse = await axios.post('http://localhost:1337/api/promidata-sync/start', {
      supplierId: 'A113'
    }, { timeout: 10000 });
    
    console.log('✅ Sync started successfully:', syncResponse.data);
    console.log('🔍 Monitor the sync progress in the admin panel or check sync status');
    
  } catch (error) {
    console.error('❌ Clean sync failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

cleanA113Sync();