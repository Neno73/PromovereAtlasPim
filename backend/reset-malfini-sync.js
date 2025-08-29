const strapi = require('./dist/index.js');

async function resetSyncStatus() {
  try {
    console.log('🔄 Starting Strapi to reset sync status...');
    
    // Find Malfini supplier (A113)
    const suppliers = await strapi.entityService.findMany('api::supplier.supplier', {
      filters: { code: 'A113' }
    });
    
    if (!suppliers || suppliers.length === 0) {
      console.log('❌ Malfini supplier (A113) not found');
      return;
    }

    const supplier = suppliers[0];
    console.log(`📍 Found supplier: ${supplier.code} - ${supplier.name}`);
    console.log(`📅 Current status: ${supplier.last_sync_status} (since ${supplier.last_sync_date})`);
    
    // Reset the sync status
    const resetTime = new Date();
    await strapi.entityService.update('api::supplier.supplier', supplier.id, {
      data: {
        last_sync_status: 'completed',
        last_sync_message: `Reset from stuck status at ${resetTime.toISOString()}`,
        last_sync_date: resetTime
      }
    });

    console.log('✅ Successfully reset Malfini sync status');
    console.log(`🕐 Reset at: ${resetTime.toISOString()}`);
    
    // Verify the update
    const updatedSupplier = await strapi.entityService.findOne('api::supplier.supplier', supplier.id);
    console.log(`✓ New status: ${updatedSupplier.last_sync_status}`);
    console.log(`✓ New message: ${updatedSupplier.last_sync_message}`);
    
  } catch (error) {
    console.error('❌ Error resetting sync status:', error);
  } finally {
    console.log('🏁 Script completed');
    process.exit(0);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  strapi().start().then(resetSyncStatus);
}

module.exports = resetSyncStatus;