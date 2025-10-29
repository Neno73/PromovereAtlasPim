# Product Hierarchy Migration Guide

**Created:** 2025-10-29
**Purpose:** Guide for migrating PromoAtlas from flat Product model to Product → Product Variant hierarchy

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Changes](#architecture-changes)
3. [Data Model Comparison](#data-model-comparison)
4. [Promidata Sync Changes](#promidata-sync-changes)
5. [Data Migration Strategy](#data-migration-strategy)
6. [Frontend Query Updates](#frontend-query-updates)
7. [Testing Checklist](#testing-checklist)

---

## Overview

### What Changed

**Before (Flat Model):**
```
Supplier → Product (single level, all data in one place)
```

**After (Hierarchy):**
```
Supplier → Product (main product/family) → Product Variant (size/color variations)
```

### Why This Change?

1. **Better data organization**: Shared product information (images, descriptions, pricing) stored once at Product level
2. **Variant management**: Size and color variations properly separated
3. **Improved catalog UI**: Can display products with selectable size/color options
4. **Reduced duplication**: Model info, main images, descriptions not duplicated per size/color
5. **Scalability**: Easier to manage products with many variants

---

## Architecture Changes

### New Content Types

#### 1. Product (Main Product/Family)
- **Location**: `src/api/product/`
- **Purpose**: Represents the main product (e.g., "Classic T-Shirt")
- **Key Fields**:
  - Core: `sku`, `a_number`, `supplier_sku`
  - Multilingual: `name`, `description`, `model_name` (JSON)
  - Components: `dimensions`, `price_tiers`, `imprint_position`
  - Media: `main_image`, `gallery_images`, `model_image`
  - Relations: `supplier` (many-to-one), `categories` (many-to-many), `variants` (one-to-many)

#### 2. Product Variant (Size/Color Variations)
- **Location**: `src/api/product-variant/`
- **Purpose**: Specific size/color combination (e.g., "Classic T-Shirt - Black - Large")
- **Key Fields**:
  - Core: `sku`, `name`, `description`
  - Variant attributes: `color`, `size`, `hex_color`, `material`
  - Dimensions: Flattened fields (`dimensions_length`, `dimensions_width`, etc.)
  - SEO: `meta_name`, `meta_description`, `meta_keywords`
  - Flags: `is_primary_for_color`, `is_active`
  - Relation: `product` (many-to-one)

---

## Data Model Comparison

### Flat Model (product-legacy)
```javascript
Product {
  sku: "TS-001-BLK-L",
  name: { en: "Black T-Shirt Large", nl: "Zwart T-shirt Large" },
  color_code: "BLACK",
  size: "L",
  price_tiers: [...],
  dimensions: {...},
  supplier: Supplier,
  // All variant data mixed with product data
}
```

### New Hierarchy
```javascript
Product {
  sku: "TS-001",
  a_number: "A001",
  name: { en: "Classic T-Shirt", nl: "Klassiek T-shirt" },
  price_tiers: [...],  // Shared pricing
  dimensions: {...},    // Average/base dimensions
  main_image: "...",    // Main product image
  supplier: Supplier,
  variants: [ProductVariant, ProductVariant, ...]
}

ProductVariant {
  sku: "TS-001-BLK-L",
  name: "Black T-Shirt - Large",
  color: "Black",
  hex_color: "#000000",
  size: "L",
  dimensions_length: 70,
  dimensions_width: 50,
  product: Product,
  is_primary_for_color: true
}
```

---

## Promidata Sync Changes

### Current Sync Logic (`promidata-sync.ts`)

**Location**: `src/api/promidata-sync/services/promidata-sync.ts`

### Required Changes

#### Step 1: Detect Product Families

Promidata sends individual products with size/color variations. We need to:

1. **Group by A-Number or Model**: Products with same `a_number` belong to same family
2. **Create Product entry** for each unique `a_number`
3. **Create Product Variant entries** for each size/color combination

**Example Grouping Logic:**
```typescript
// In syncSupplier method

async syncSupplier(supplierCode: string) {
  // ... existing code ...

  // Group products by a_number
  const productsByFamily = new Map<string, any[]>();

  for (const rawProduct of promidataProducts) {
    const aNumber = rawProduct.a_number || rawProduct.model;
    if (!productsByFamily.has(aNumber)) {
      productsByFamily.set(aNumber, []);
    }
    productsByFamily.get(aNumber).push(rawProduct);
  }

  // Process each product family
  for (const [aNumber, variantData] of productsByFamily) {
    await this.createOrUpdateProductFamily(aNumber, variantData, supplier);
  }
}
```

#### Step 2: Create/Update Product Family

```typescript
async createOrUpdateProductFamily(aNumber: string, variantData: any[], supplier: any) {
  // Use first variant for shared product data
  const baseVariant = variantData[0];

  // Calculate product-level hash
  const productHash = this.calculateProductHash({
    aNumber,
    name: baseVariant.name,
    description: baseVariant.description,
    model_name: baseVariant.model_name
  });

  // Check if product exists
  const existingProduct = await strapi.db.query('api::product.product').findOne({
    where: { a_number: aNumber, supplier: supplier.id }
  });

  let product;
  if (!existingProduct || existingProduct.promidata_hash !== productHash) {
    // Create or update Product
    const productData = {
      sku: aNumber,  // Use a_number as product SKU
      a_number: aNumber,
      supplier_sku: baseVariant.supplier_sku,
      supplier_name: supplier.name,
      brand: baseVariant.brand,
      name: baseVariant.name,  // Multilingual JSON
      description: baseVariant.description,  // Multilingual JSON
      model_name: baseVariant.model_name,  // Multilingual JSON
      price_tiers: this.extractPriceTiers(baseVariant),
      dimensions: this.extractDimensions(baseVariant),
      main_image: await this.uploadMainImage(baseVariant),
      gallery_images: await this.uploadGalleryImages(baseVariant),
      supplier: supplier.id,
      promidata_hash: productHash,
      total_variants_count: variantData.length,
      is_active: true
    };

    if (existingProduct) {
      product = await strapi.entityService.update(
        'api::product.product',
        existingProduct.id,
        { data: productData }
      );
    } else {
      product = await strapi.entityService.create(
        'api::product.product',
        { data: productData }
      );
    }
  } else {
    product = existingProduct;
  }

  // Process each variant
  await this.syncProductVariants(product, variantData);
}
```

#### Step 3: Sync Product Variants

```typescript
async syncProductVariants(product: any, variantData: any[]) {
  const colorGroups = new Map<string, any[]>();

  // Group by color for primary detection
  for (const variant of variantData) {
    const color = variant.color_code || variant.search_color;
    if (!colorGroups.has(color)) {
      colorGroups.set(color, []);
    }
    colorGroups.get(color).push(variant);
  }

  for (const [color, variants] of colorGroups) {
    // First variant of each color is primary
    let isFirst = true;

    for (const variantRaw of variants) {
      const variantHash = this.calculateVariantHash(variantRaw);

      const existingVariant = await strapi.db.query('api::product-variant.product-variant').findOne({
        where: { sku: variantRaw.sku }
      });

      const variantData = {
        sku: variantRaw.sku,
        product: product.id,
        name: `${variantRaw.name.en} - ${variantRaw.color_name?.en || color} - ${variantRaw.size || ''}`,
        description: variantRaw.description?.en || '',
        color: variantRaw.color_name?.en || color,
        hex_color: variantRaw.hex_color,
        supplier_color_code: variantRaw.color_code,
        supplier_search_color: variantRaw.search_color,
        size: variantRaw.size,
        sizes: variantRaw.available_sizes,
        material: variantRaw.material?.en,
        country_of_origin: variantRaw.country_of_origin,
        dimensions_length: variantRaw.length,
        dimensions_width: variantRaw.width,
        dimensions_height: variantRaw.height,
        dimensions_diameter: variantRaw.diameter,
        weight: variantRaw.weight,
        primary_image: await this.uploadVariantImage(variantRaw),
        is_primary_for_color: isFirst,
        is_active: true
      };

      if (existingVariant) {
        await strapi.entityService.update(
          'api::product-variant.product-variant',
          existingVariant.id,
          { data: variantData }
        );
      } else {
        await strapi.entityService.create(
          'api::product-variant.product-variant',
          { data: variantData }
        );
      }

      isFirst = false;  // Only first variant is primary
    }
  }
}
```

#### Step 4: Hash Calculation

```typescript
calculateProductHash(productData: any): string {
  const dataToHash = {
    aNumber: productData.aNumber,
    name: productData.name,
    description: productData.description,
    model_name: productData.model_name
  };

  return crypto.createHash('md5')
    .update(JSON.stringify(dataToHash))
    .digest('hex');
}

calculateVariantHash(variantData: any): string {
  const dataToHash = {
    sku: variantData.sku,
    color: variantData.color_code,
    size: variantData.size,
    dimensions: {
      length: variantData.length,
      width: variantData.width,
      height: variantData.height
    }
  };

  return crypto.createHash('md5')
    .update(JSON.stringify(dataToHash))
    .digest('hex');
}
```

---

## Data Migration Strategy

### Option 1: Fresh Start (Recommended for Testing)

1. **Delete existing products** in database
2. **Run full Promidata sync** with new hierarchy logic
3. **Verify** data structure in Strapi admin

```sql
-- CAUTION: This deletes all products!
DELETE FROM product_variants;
DELETE FROM products;
-- Then run sync
```

### Option 2: Gradual Migration (Production)

1. **Keep product-legacy** folder as backup
2. **Run migration script** to convert flat products to hierarchy
3. **Sync new products** only for one supplier first
4. **Verify** and expand to all suppliers

**Migration Script Outline:**
```typescript
async function migrateProductsToHierarchy() {
  const legacyProducts = await strapi.db.query('api::product-legacy.product-legacy').findMany();

  // Group by a_number
  const families = new Map();
  for (const product of legacyProducts) {
    const aNumber = product.a_number;
    if (!families.has(aNumber)) {
      families.set(aNumber, []);
    }
    families.get(aNumber).push(product);
  }

  // Create Product + Variants for each family
  for (const [aNumber, products] of families) {
    // Create Product from first item
    const base = products[0];
    const newProduct = await strapi.entityService.create('api::product.product', {
      data: {
        sku: aNumber,
        a_number: aNumber,
        name: base.name,
        description: base.description,
        // ... other fields
        supplier: base.supplier.id
      }
    });

    // Create Variants for each product
    for (const p of products) {
      await strapi.entityService.create('api::product-variant.product-variant', {
        data: {
          sku: p.sku,
          product: newProduct.id,
          color: p.color_name,
          size: p.size,
          // ... other fields
        }
      });
    }
  }
}
```

---

## Frontend Query Updates

### Old Query (Flat Model)
```typescript
// Get all products
const products = await fetch('/api/products?populate=*');
```

### New Queries (Hierarchy)

#### Get Products with Variants
```typescript
const products = await fetch('/api/products?populate[variants][populate]=primary_image&populate[supplier]=true&populate[main_image]=true');
```

#### Get Product with All Details
```typescript
const product = await fetch(`/api/products/${id}?populate[variants][populate][primary_image]=true&populate[variants][populate][gallery_images]=true&populate[dimensions]=true&populate[price_tiers]=true&populate[supplier]=true&populate[categories]=true&populate[main_image]=true&populate[gallery_images]=true`);
```

#### Get Primary Variants (for Product Listing)
```typescript
// Get products with only primary variants for each color
const products = await fetch('/api/products?populate[variants][filters][is_primary_for_color][$eq]=true&populate[variants][populate]=primary_image&populate[main_image]=true');
```

#### Get Specific Variant
```typescript
const variant = await fetch(`/api/product-variants/${variantId}?populate[product][populate]=supplier&populate[primary_image]=true&populate[gallery_images]=true`);
```

---

## Testing Checklist

### Schema Validation
- [ ] Strapi builds without errors
- [ ] Product content type visible in admin
- [ ] Product Variant content type visible in admin
- [ ] Relations properly configured (Product ↔ Variants, Product ↔ Supplier)

### CRUD Operations
- [ ] Can create Product manually in admin
- [ ] Can create Product Variant linked to Product
- [ ] Can upload images to both Product and Variant
- [ ] Price tiers component works on Product
- [ ] Dimensions component works on Product

### Public API
- [ ] `/api/products` returns products
- [ ] `/api/product-variants` returns variants
- [ ] Populate queries work correctly
- [ ] Filtering works (by supplier, category, color, size)

### Sync Testing
- [ ] Full sync creates products correctly
- [ ] Products grouped by a_number
- [ ] Variants linked to correct product
- [ ] Primary variant flag set correctly
- [ ] Hash-based change detection works
- [ ] Images uploaded to R2

### Frontend Integration
- [ ] Product listing displays correctly
- [ ] Product detail page shows variants
- [ ] Size/color selection works
- [ ] Images display from both Product and Variant
- [ ] Filtering by variant attributes works

---

## Rollback Procedure

If migration fails:

1. **Stop Strapi server**
2. **Restore product schema:**
   ```bash
   rm -rf src/api/product src/api/product-variant
   mv src/api/product-legacy src/api/product
   ```
3. **Restore index.ts permissions** (remove product-variant)
4. **Restart Strapi**

---

## Common Issues & Solutions

### Issue: Variants not linking to Product
**Cause**: Relation not properly set
**Solution**: Verify `product` field in variant data has correct product ID

### Issue: Images not uploading
**Cause**: R2 credentials issue or image URL format
**Solution**: Check R2 configuration, verify image URLs are accessible

### Issue: Duplicate products created
**Cause**: Grouping logic not working
**Solution**: Verify `a_number` field exists and is consistent across variants

### Issue: Primary variant not set
**Cause**: Color grouping logic issue
**Solution**: Check color field extraction, ensure first variant of each color is marked

---

## Next Steps

1. **Test schema creation**: Run `npm run build` to verify schemas
2. **Manual testing**: Create sample Product + Variants in admin
3. **Update sync service**: Implement changes outlined above
4. **Test sync**: Run sync for one small supplier
5. **Frontend updates**: Modify queries to use new hierarchy
6. **Full deployment**: Migrate all suppliers and update production

---

**For questions or issues, refer to the blueprint:** `/home/neno/Code/PIM/STRAPI_CONTENT_TYPE_BLUEPRINT.md`
