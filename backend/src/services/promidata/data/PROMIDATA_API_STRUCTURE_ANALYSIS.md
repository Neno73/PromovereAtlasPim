# Promidata API Data Structure Analysis

**Date**: 2025-11-16
**Sample Data**: A23-100804.json (Renew AWARE™ rPET Tote Bag)

## Executive Summary

Analyzed actual Promidata JSON structure reveals significant differences from transformer expectations:

**Critical Findings**:
1. **Pricing**: NOT stored as `price_1`, `price_2`, etc. → Uses `ProductPriceCountryBased` object with arrays
2. **Colors**: NOT in direct fields → Stored in `NonLanguageDependedProductDetails.SearchColor` and `ConfigurationFields`
3. **Sizes**: NOT found in most products → May be in `ConfigurationFields` for size-specific items
4. **Hex Colors**: Field exists but often `null` → `NonLanguageDependedProductDetails.HexColor`
5. **Structure**: Hierarchical (Parent product + ChildProducts array)

---

## Actual JSON Structure (Top-Level Keys)

```json
{
  "ANumber": "100804",                    // Product family identifier
  "Sku": "100804",                        // Parent SKU
  "SupplierSku": "P100.804",              // Supplier's SKU
  "Ean": null,                            // Barcode
  "ChildProducts": [...],                 // Array of variants (color/size combos)
  "DefaultProducts": null,
  "ProductDetails": {...},                // Multilingual fields (de, fr, en, etc.)
  "NonLanguageDependedProductDetails": {...},  // Dimensions, brand, category, etc.
  "ProductPriceCountryBased": {...},      // Pricing per country (BENELUX, etc.)
  "ProductPriceRegionBased": null,        // Regional pricing (unused in samples)
  "ProductCosts": null,                   // Cost data
  "SamplePriceCountryBased": null,        // Sample pricing
  "ImprintPositions": [...],              // Customization positions
  "ImprintReferences": [...],             // Imprint reference images
  "BatteryInformation": null,             // Battery compliance
  "ProductCertificates": [...],           // Certifications
  "RequiredCertificates": null,
  "ForbiddenRegions": [],                 // Restricted regions
  "VideoUrl": null,                       // Product video
  "Errors": null,
  "Warnings": null,
  "ChildHasErrors": false
}
```

---

## 1. COLOR INFORMATION

### Actual Structure

#### Parent Level:
```json
"NonLanguageDependedProductDetails": {
  "SearchColor": "Undefined",  // Often "Undefined" at parent level
  "HexColor": null             // Often null at parent level
}
```

#### Child Product Level (Variant):
```json
"ChildProducts": [
  {
    "NonLanguageDependedProductDetails": {
      "SearchColor": "Black",     // Actual color name ✅
      "HexColor": null            // Often null even for variants
    },
    "ProductDetails": {
      "de": {
        "ConfigurationFields": [
          {
            "ConfigurationName": "Color",
            "ConfigurationNameTranslated": "Farbe",
            "ConfigurationValue": "schwarz (± PMS Black)"  // Detailed color ✅
          }
        ]
      }
    }
  }
]
```

### Transformer Expectations vs Reality

| Field Expected | Actual Location | Status |
|---------------|----------------|--------|
| `data.color_name` | `ChildProducts[].NonLanguageDependedProductDetails.SearchColor` | ❌ Wrong path |
| `data.ColorName` | N/A | ❌ Not found |
| `data.colorName` | N/A | ❌ Not found |
| `data.hex_color` | `ChildProducts[].NonLanguageDependedProductDetails.HexColor` | ⚠️ Often null |
| `data.HexColor` | Same as above | ⚠️ Often null |

**Recommended Fix**:
```typescript
// For VARIANTS (ChildProducts):
private extractColorName(data: RawProductData): string | null {
  // NEW: Check NonLanguageDependedProductDetails.SearchColor first
  if (data.NonLanguageDependedProductDetails?.SearchColor) {
    const color = data.NonLanguageDependedProductDetails.SearchColor;
    if (color !== 'Undefined') {
      return color;
    }
  }

  // NEW: Check ConfigurationFields for "Color"
  if (data.ProductDetails) {
    for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
      const configFields = data.ProductDetails[lang]?.ConfigurationFields;
      if (Array.isArray(configFields)) {
        const colorField = configFields.find(f => f.ConfigurationName === 'Color');
        if (colorField?.ConfigurationValue) {
          return colorField.ConfigurationValue;
        }
      }
    }
  }

  // FALLBACK: Old pattern (legacy support)
  return data.color_name || data.ColorName || data.colorName || null;
}
```

---

## 2. SIZE INFORMATION

### Actual Structure

Sizes are NOT commonly present in Promidata data. When they exist:

```json
"ProductDetails": {
  "de": {
    "ConfigurationFields": [
      {
        "ConfigurationName": "Size",
        "ConfigurationNameTranslated": "Größe",
        "ConfigurationValue": "Large"
      }
    ]
  }
}
```

### Transformer Expectations vs Reality

| Field Expected | Actual Location | Status |
|---------------|----------------|--------|
| `data.size` | `ProductDetails[lang].ConfigurationFields[].ConfigurationValue` (where ConfigurationName === "Size") | ❌ Wrong path |
| `data.Size` | N/A | ❌ Not found |
| `data.SIZE` | N/A | ❌ Not found |

**Recommended Fix**:
```typescript
private extractSize(data: RawProductData): string | null {
  // NEW: Check ConfigurationFields for "Size"
  if (data.ProductDetails) {
    for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
      const configFields = data.ProductDetails[lang]?.ConfigurationFields;
      if (Array.isArray(configFields)) {
        const sizeField = configFields.find(f => f.ConfigurationName === 'Size');
        if (sizeField?.ConfigurationValue) {
          return sizeField.ConfigurationValue;
        }
      }
    }
  }

  // FALLBACK: Old pattern (legacy support)
  return data.size || data.Size || data.SIZE || null;
}
```

---

## 3. PRICE TIERS

### Actual Structure

Prices are stored in `ProductPriceCountryBased` (or `ProductPriceRegionBased`), NOT as flat fields:

```json
"ProductPriceCountryBased": {
  "BENELUX": {
    "RecommendedSellingPrice": [
      {
        "Price": 7.95,
        "Quantity": 1500,
        "OnRequest": false,
        "Valuta": "EURO"
      }
    ],
    "GeneralBuyingPrice": [
      {
        "Price": 5.72,
        "Quantity": 1500,
        "OnRequest": false,
        "Valuta": "EURO"
      }
    ],
    "QuantityIncrements": 1,
    "VatPercentage": 0,
    "MinimumOrderQuantity": 1,
    "VatSettingId": 1
  },
  "GERMANY": { ... },
  "FRANCE": { ... }
}
```

### Transformer Expectations vs Reality

| Field Expected | Actual Location | Status |
|---------------|----------------|--------|
| `data.price_1` | `ProductPriceCountryBased[region].RecommendedSellingPrice[0].Price` | ❌ Wrong structure |
| `data.Price1` | N/A | ❌ Not found |
| `data.PRICE_1` | N/A | ❌ Not found |
| `data.min_qty_1` | `ProductPriceCountryBased[region].RecommendedSellingPrice[0].Quantity` | ❌ Wrong structure |
| `data.PriceDetails` | N/A | ❌ Not found in samples |

**Recommended Fix**:
```typescript
private extractPriceTiers(data: RawProductData): any {
  const priceTiers = [];

  // NEW: Extract from ProductPriceCountryBased
  if (data.ProductPriceCountryBased) {
    // Default to BENELUX region (or make configurable)
    const regions = Object.keys(data.ProductPriceCountryBased);
    const defaultRegion = regions.includes('BENELUX') ? 'BENELUX' : regions[0];

    if (defaultRegion) {
      const regionPricing = data.ProductPriceCountryBased[defaultRegion];

      // Extract recommended selling prices
      if (regionPricing.RecommendedSellingPrice && Array.isArray(regionPricing.RecommendedSellingPrice)) {
        regionPricing.RecommendedSellingPrice.forEach((priceObj, index) => {
          priceTiers.push({
            tier: index + 1,
            price: parseFloat(priceObj.Price),
            min_quantity: priceObj.Quantity || null,
            currency: priceObj.Valuta || 'EUR',
            price_type: 'selling',
            region: defaultRegion
          });
        });
      }

      // Also extract buying prices
      if (regionPricing.GeneralBuyingPrice && Array.isArray(regionPricing.GeneralBuyingPrice)) {
        regionPricing.GeneralBuyingPrice.forEach((priceObj, index) => {
          priceTiers.push({
            tier: index + 1,
            price: parseFloat(priceObj.Price),
            min_quantity: priceObj.Quantity || null,
            currency: priceObj.Valuta || 'EUR',
            price_type: 'buying',
            region: defaultRegion
          });
        });
      }
    }
  }

  // FALLBACK: Old pattern (legacy support)
  if (priceTiers.length === 0) {
    for (let i = 1; i <= 8; i++) {
      const price = data[`price_${i}`] || data[`Price${i}`] || data[`PRICE_${i}`];
      const minQty = data[`min_qty_${i}`] || data[`MinQty${i}`] || (i === 1 ? 1 : null);

      if (price !== undefined && price !== null) {
        priceTiers.push({
          tier: i,
          price: parseFloat(price),
          min_quantity: minQty ? parseInt(minQty) : null,
        });
      }
    }
  }

  return priceTiers.length > 0 ? priceTiers : undefined;
}
```

---

## 4. DIMENSIONS

### Actual Structure (CORRECT ✅)

Dimensions are correctly extracted from `NonLanguageDependedProductDetails`:

```json
"NonLanguageDependedProductDetails": {
  "Weight": 175,             // Grams
  "DimensionsLength": 280,   // mm
  "DimensionsHeight": 381,   // mm
  "DimensionsDiameter": 0,   // mm
  "DimensionsWidth": 127,    // mm
  "DimensionsDepth": 0       // mm (rarely used)
}
```

**Current transformer is CORRECT** for dimensions. ✅

---

## 5. MULTILINGUAL FIELDS

### Actual Structure (CORRECT ✅)

Multilingual fields are correctly extracted from `ProductDetails[lang]`:

```json
"ProductDetails": {
  "de": {
    "Name": "Renew AWARE™ rPET Tragetasche mit Reißverschluss",
    "Description": "Eine moderne und nachhaltige...",
    "ShortDescription": null,
    "Image": {
      "Url": "https://images.promi-dl.de/...",
      "Description": "",
      "FileName": "100804-001__B_1__e30251ad66df423fa457b6ae38a2715a.jpg"
    },
    "MediaGalleryImages": [
      { "Url": "...", "Description": "", "FileName": "..." }
    ]
  },
  "fr": { ... },
  "en": { ... }
}
```

**Current transformer is CORRECT** for multilingual fields. ✅

---

## 6. IMAGES

### Actual Structure (CORRECT ✅)

Images are correctly extracted from `ProductDetails[lang].Image.Url` and `MediaGalleryImages`:

```json
"ProductDetails": {
  "de": {
    "Image": {
      "Url": "https://images.promi-dl.de/Images/LiveR2/.../36fc3ada453f.jpg"
    },
    "MediaGalleryImages": [
      { "Url": "https://images.promi-dl.de/.../17a17cf3056997.jpg" },
      { "Url": "https://images.promi-dl.de/.../5d31eac1ef52bb.jpg" }
    ]
  }
}
```

**Current transformer is CORRECT** for images. ✅

---

## 7. HIERARCHICAL STRUCTURE (Parent + ChildProducts)

### Actual Structure

Promidata uses a parent-child hierarchy:

```
Parent Product (a_number: "100804")
├── ChildProducts[0] (sku: "100804-001", color: Black)
├── ChildProducts[1] (sku: "100804-002", color: Navy)
└── ChildProducts[2] (sku: "100804-003", color: Red)
```

**Parent** contains:
- Shared fields (brand, category, supplier)
- Shared pricing (`ProductPriceCountryBased`)
- Shared multilingual fields (`ProductDetails`)
- Overall dimensions (`NonLanguageDependedProductDetails`)

**ChildProducts** contain:
- Individual SKU
- Individual color (`NonLanguageDependedProductDetails.SearchColor`)
- Individual images (color-specific)
- Individual `ConfigurationFields` (Color, Size if applicable)

**Current transformer uses FIRST VARIANT** as base for Product. This is acceptable but should be documented.

---

## SUMMARY: Field Mapping Table

| Transformer Field | Expected Path | Actual Path | Status |
|------------------|---------------|-------------|--------|
| **Brand** | `data.Brand` | `NonLanguageDependedProductDetails.Brand` | ✅ Correct |
| **Name** | `ProductDetails[lang].Name` | `ProductDetails[lang].Name` | ✅ Correct |
| **Description** | `ProductDetails[lang].Description` | `ProductDetails[lang].Description` | ✅ Correct |
| **Material** | `ProductDetails[lang].WebShopInformation.Material.InformationValue` | Same | ✅ Correct |
| **Dimensions** | `NonLanguageDependedProductDetails.Dimensions*` | Same | ✅ Correct |
| **Images** | `ProductDetails[lang].Image.Url` | Same | ✅ Correct |
| **Color (variant)** | `data.color_name` | `NonLanguageDependedProductDetails.SearchColor` OR `ConfigurationFields[Color]` | ❌ **WRONG** |
| **Size (variant)** | `data.size` | `ConfigurationFields[Size]` (if exists) | ❌ **WRONG** |
| **Hex Color** | `data.hex_color` | `NonLanguageDependedProductDetails.HexColor` (often null) | ⚠️ **PARTIAL** |
| **Price Tiers** | `data.price_1, price_2, ...` | `ProductPriceCountryBased[region].RecommendedSellingPrice[]` | ❌ **WRONG** |
| **Min Quantity** | `data.min_qty_1, ...` | `ProductPriceCountryBased[region].RecommendedSellingPrice[].Quantity` | ❌ **WRONG** |

---

## RECOMMENDED FIXES (Priority Order)

### 1. **CRITICAL**: Fix Price Tier Extraction
- Current: Looking for `price_1`, `price_2`, etc.
- Actual: `ProductPriceCountryBased[region].RecommendedSellingPrice[]`
- Impact: **All products have no pricing currently**

### 2. **HIGH**: Fix Color Extraction for Variants
- Current: Looking for `data.color_name`
- Actual: `NonLanguageDependedProductDetails.SearchColor` or `ConfigurationFields[Color]`
- Impact: **available_colors array is empty**

### 3. **MEDIUM**: Fix Size Extraction
- Current: Looking for `data.size`
- Actual: `ConfigurationFields[Size]` (when exists)
- Impact: **available_sizes array is empty**

### 4. **LOW**: Fix Hex Color Extraction
- Current: Looking for `data.hex_color`
- Actual: `NonLanguageDependedProductDetails.HexColor` (but often null)
- Impact: **hex_colors array is empty (acceptable, as hex is often not provided)**

---

## SAMPLE DATA LOCATION

Full sample JSON saved to:
```
/home/neno/Code/PromovereAtlasPim/backend/src/services/promidata/data/sample-A23-100804.json
```

Use this for testing transformer changes.

---

## NEXT STEPS

1. Update `product-transformer.ts`:
   - Fix `extractPriceTiers()` method
   - Fix `calculateMinPrice()` / `calculateMaxPrice()` methods

2. Update `variant-transformer.ts`:
   - Fix `extractColorName()` method
   - Fix `extractSize()` method
   - Fix `extractHexColor()` method

3. Test with sample data:
   ```bash
   cd backend
   node --loader ts-node/esm src/services/promidata/test-transformer.ts
   ```

4. Run full sync to verify changes:
   ```bash
   # Via Strapi admin or API
   POST /api/promidata-sync/start
   ```
