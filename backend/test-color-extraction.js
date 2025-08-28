#!/usr/bin/env node

// Test color extraction logic directly
const axios = require('axios');

async function testColorExtraction() {
  try {
    console.log('🧪 Testing color extraction logic...');
    
    // Fetch sample product data
    const url = 'https://promi-dl.de/Profiles/Live/849c892e-b443-4f49-be3a-61a351cbdd23/A389/A389-GIL5000.json';
    const response = await axios.get(url);
    const productData = response.data;
    
    if (!productData.ChildProducts || productData.ChildProducts.length === 0) {
      console.log('❌ No child products found');
      return;
    }
    
    // Test first child product
    const childProduct = productData.ChildProducts[0];
    console.log(`📦 Testing with child product: ${childProduct.SupplierSku}`);
    
    // Manually implement the color extraction logic to test
    let hexColor = null;
    let supplierColorCode = null;
    let pmsColor = null;
    
    console.log('🔍 Checking NonLanguageDependedProductDetails...');
    console.log('Structure:', JSON.stringify(childProduct.NonLanguageDependedProductDetails, null, 2));
    
    // Extract hex color from NonLanguageDependedProductDetails
    if (childProduct.NonLanguageDependedProductDetails?.HexColor) {
      hexColor = childProduct.NonLanguageDependedProductDetails.HexColor;
      console.log(`✅ Found hex color: ${hexColor}`);
    } else {
      console.log('❌ No hex color found in NonLanguageDependedProductDetails');
    }
    
    // Extract supplier color code from UnstructuredInformation
    if (childProduct.ProductDetails) {
      console.log('🔍 Checking ProductDetails...');
      const languages = ['en', 'nl', 'de', 'fr'];
      for (const lang of languages) {
        const langDetails = childProduct.ProductDetails[lang];
        if (langDetails?.UnstructuredInformation) {
          console.log(`📝 ${lang} UnstructuredInformation:`, langDetails.UnstructuredInformation);
          if (langDetails.UnstructuredInformation.SupplierSearchColor && !supplierColorCode) {
            supplierColorCode = langDetails.UnstructuredInformation.SupplierSearchColor;
            console.log(`✅ Found supplier color code: ${supplierColorCode}`);
          }
          if (langDetails.UnstructuredInformation.PMSValue && !pmsColor) {
            pmsColor = langDetails.UnstructuredInformation.PMSValue;
            console.log(`✅ Found PMS color: ${pmsColor}`);
          }
        }
      }
    }
    
    console.log('🎯 Final extracted data:');
    console.log(`  hexColor: ${hexColor}`);
    console.log(`  supplierColorCode: ${supplierColorCode}`);
    console.log(`  pmsColor: ${pmsColor}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testColorExtraction();