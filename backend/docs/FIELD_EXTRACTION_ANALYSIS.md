# Field Extraction Analysis - Product vs ProductVariant

**Date**: 2025-11-03
**Status**: Comprehensive analysis of what fields to extract from Promidata

---

## Key Principles

### 1. Data Source Hierarchy

```
Promidata JSON File (e.g., A360-AACBAG_TB01.json)
├─ Parent Level → Product (family-level shared data)
│  ├─ ProductDetails (multilingual)
│  ├─ NonLanguageDependedProductDetails
│  └─ Other top-level fields
│
└─ ChildProducts[0...N] → ProductVariant (variant-specific data)
   ├─ ProductDetails (multilingual - variant-specific)
   ├─ NonLanguageDependedProductDetails (variant-specific)
   └─ Dimensions, colors, sizes
```

### 2. Category Source

**Categories come from CAT.csv (separate import)** - NOT from product JSON!

- Product.category (string) = Promidata category PATH (e.g., "BAGS/BEACH_BAGS")
- Product.categories (relation) = Linked category entities from CAT.csv import

### 3. Image Storage

**Images belong to VARIANTS** (ChildProducts), not Product!
- ProductVariant.primary_image = ChildProducts[0].ProductDetails[lang].Image.Url
- ProductVariant.gallery_images = ChildProducts[0].ProductDetails[lang].MediaGalleryImages[].Url
- Product.main_image = (optional) First variant's primary image as reference
- Product.gallery_images = (optional) Aggregated from variants

---

## Product Schema (Parent/Family Level)

### Fields That SHOULD Be Extracted (Missing!)

| Field | Type | Promidata Location | Status | Priority |
|-------|------|-------------------|--------|----------|
| `brand` | string | ❌ **EMPTY in Promidata** (A360 has `""`) | Expected empty | N/A |
| `category` | string | `NonLanguageDependedProductDetails.Category` | ✅ Should extract | HIGH |
| `default_products` | string | `ProductDetails[lang].DefaultProducts` | ❓ Need to verify | MEDIUM |
| `battery_information` | string | `BatteryInformation` (top-level or lang) | ❓ Need to verify | LOW |
| `required_certificates` | string | `RequiredCertificates` (top-level or lang) | ❓ Need to verify | LOW |
| `short_description` | json | `ProductDetails[lang].ShortDescription` | ✅ Should extract | HIGH |
| `material` | json | `ProductDetails[lang].WebShopInformation.Material.InformationValue` | ✅ Should extract | HIGH |
| `customization` | json | `ProductDetails[lang].ImprintPositions[].ImprintPositionName` | ✅ Should extract | MEDIUM |
| `refining` | json | `ProductDetails[lang].ConfigurationFields` (non-Color/Size) | ✅ Should extract | MEDIUM |
| `refining_dimensions` | json | `ProductDetails[lang].ImprintPositions[].DimensionWidth/Height` | ✅ Should extract | MEDIUM |
| `refining_location` | json | `ProductDetails[lang].ImprintPositions[].ImprintPositionName` | ✅ Should extract | MEDIUM |
| `web_shop_info` | json | `ProductDetails[lang].WebShopInformation` | ✅ Should extract | MEDIUM |
| `product_filters` | json | `ProductDetails[lang].ProductFilters` | ❓ Need to verify | LOW |
| `country_of_origin` | string | `NonLanguageDependedProductDetails.CountryOfOrigin` | ✅ Should extract | MEDIUM |
| `delivery_time` | string | `NonLanguageDependedProductDetails.DeliveryTime` or `ProductDetails[lang].DeliveryTime` | ✅ Should extract | MEDIUM |
| `customs_tariff_number` | string | `NonLanguageDependedProductDetails.CustomsTariffNumber` | ✅ Should extract | LOW |
| `tax` | enum H/L | `PriceDetails[0].PriceTaxIndicator` | ❓ Need to verify | MEDIUM |
| `must_have_imprint` | boolean | `NonLanguageDependedProductDetails.MustHaveImprint` | ✅ Should extract | LOW |
| `maxcolors` | integer | `ProductDetails[lang].ImprintPositions[].MaxColors` (max value) | ✅ Should extract | LOW |
| `print_option_group` | string | `ProductDetails[lang].ImprintPositions[0].PrintOptionGroup` | ✅ Should extract | LOW |

### Fields Currently Extracted Correctly

| Field | Promidata Location | Status |
|-------|-------------------|--------|
| `sku` | Parent `.Sku` | ✅ Working |
| `a_number` | Parent `.Sku` (used as family ID for Pattern A) | ✅ Working |
| `supplier_sku` | Parent `.SupplierSku` | ✅ Working |
| `supplier_name` | Parent `.SupplierName` | ✅ Working |
| `name` | Parent `.ProductDetails[lang].Name` | ✅ Working |
| `description` | Parent `.ProductDetails[lang].Description` | ✅ Working |
| `model_name` | Parent `.ProductDetails[lang].ModelName` | ✅ Working |
| `dimensions` | Parent `.NonLanguageDependedProductDetails.Dimensions*` | ✅ Working |
| `price_tiers` | Parent `.PriceDetails[]` | ❓ Need to verify |
| `imprint_position` | Parent `.ProductDetails[lang].ImprintPositions[]` | ❓ Need to verify |

### Images at Product Level (Optional - Reference Only)

**Note**: Images primarily belong to variants. Product-level images are for quick reference.

| Field | Source | Status |
|-------|--------|--------|
| `main_image` | First variant's primary_image | ❌ Not currently implemented |
| `gallery_images` | Aggregated from all variants | ❌ Not currently implemented |
| `model_image` | Special model image if exists | ❌ Not in Promidata |

---

## ProductVariant Schema (Child/Variant Level)

### Fields That SHOULD Be Extracted (Missing!)

| Field | Type | Promidata Location | Status | Priority |
|-------|------|-------------------|--------|----------|
| `short_description` | text | `ChildProducts[0].ProductDetails[lang].ShortDescription` | ✅ Should extract | HIGH |
| `meta_name` | string | `ChildProducts[0].ProductDetails[lang].MetaName` | ✅ Should extract | MEDIUM |
| `meta_description` | text | `ChildProducts[0].ProductDetails[lang].MetaDescription` | ✅ Should extract | MEDIUM |
| `meta_keywords` | text | `ChildProducts[0].ProductDetails[lang].MetaKeywords` | ✅ Should extract | MEDIUM |
| `supplier_main_category` | string | `ChildProducts[0].NonLanguageDependedProductDetails.Category` | ✅ Should extract | HIGH |
| `material` | string | `ChildProducts[0].ProductDetails[lang].WebShopInformation.Material.InformationValue` | ✅ Should extract | HIGH |
| `country_of_origin` | string | `ChildProducts[0].NonLanguageDependedProductDetails.CountryOfOrigin` | ✅ Should extract | MEDIUM |
| `production_time` | string | `ChildProducts[0].ProductDetails[lang].ProductionTime` or `DeliveryTime` | ✅ Should extract | MEDIUM |
| `supplier_search_color` | string | `ChildProducts[0].NonLanguageDependedProductDetails.SearchColor` | ✅ Should extract | HIGH |
| `color` | string | Extract from `ConfigurationFields` where `ConfigurationName === "Color"` | ✅ Should extract | HIGH |
| `size` | string | Extract from `ConfigurationFields` where `ConfigurationName === "Size"` | ✅ Should extract | HIGH |
| `sizes` | json | Array of available sizes for this color variant | ❓ Logic needed | MEDIUM |
| `information_files` | media | `ChildProducts[0].ProductDetails[lang].InformationFiles` or `MediaFiles` | ❓ Need to verify | LOW |

### Fields Currently Extracted Correctly

| Field | Promidata Location | Status |
|-------|-------------------|--------|
| `sku` | `ChildProducts[0].Sku` | ✅ Working |
| `name` | `ChildProducts[0].ProductDetails[lang].Name` | ✅ Working |
| `description` | `ChildProducts[0].ProductDetails[lang].Description` | ✅ Working |
| `primary_image` | `ChildProducts[0].ProductDetails[lang].Image.Url` | ✅ Fixed! |
| `gallery_images` | `ChildProducts[0].ProductDetails[lang].MediaGalleryImages[].Url` | ✅ Fixed! |
| `dimensions_*` | `ChildProducts[0].NonLanguageDependedProductDetails.Dimensions*` | ✅ Working |
| `weight` | `ChildProducts[0].NonLanguageDependedProductDetails.Weight` | ✅ Working |

### Fields That DON'T Exist in Promidata (Correctly Empty)

| Field | Reason |
|-------|--------|
| `hex_color` | Promidata only provides color names, not hex codes |
| `supplier_color_code` | Not provided by Promidata |
| `tron_logo_enabled` | PromoAtlas-specific flag |
| `tron_logo_reference` | PromoAtlas-specific reference |
| `usb_item` | May need to infer from product category/name |
| `fragile` | Not provided by Promidata |
| `embroidery_sizes` | Not provided by Promidata |
| `is_service_base` | PromoAtlas-specific flag |

---

## Extraction Fixes Needed

### File 1: `product-transformer.ts`

#### Current Issues:
1. ❌ Missing `category` extraction (line ~75)
2. ❌ Missing `short_description` extraction
3. ❌ Missing `material` extraction
4. ❌ Missing `customization` fields extraction
5. ❌ Missing `refining` fields extraction
6. ❌ Missing `web_shop_info` extraction
7. ❌ Missing `country_of_origin` extraction
8. ❌ Missing `delivery_time` extraction
9. ❌ Missing other metadata fields

#### Fixes Required:

**Add to `transform()` method (around line 75):**
```typescript
category: this.extractCategory(baseVariant),
short_description: this.extractMultilingualShortDescription(baseVariant),
material: this.extractMultilingualMaterial(baseVariant),
customization: this.extractCustomization(baseVariant),
refining: this.extractRefining(baseVariant),
refining_dimensions: this.extractRefiningDimensions(baseVariant),
refining_location: this.extractRefiningLocation(baseVariant),
web_shop_info: this.extractWebShopInfo(baseVariant),
country_of_origin: this.extractCountryOfOrigin(baseVariant),
delivery_time: this.extractDeliveryTime(baseVariant),
customs_tariff_number: this.extractCustomsTariffNumber(baseVariant),
tax: this.extractTax(baseVariant),
must_have_imprint: this.extractMustHaveImprint(baseVariant),
maxcolors: this.extractMaxColors(baseVariant),
print_option_group: this.extractPrintOptionGroup(baseVariant),
```

**New extraction methods needed** (~16 methods, ~400 lines of code):
- extractCategory()
- extractMultilingualShortDescription()
- extractMultilingualMaterial()
- extractCustomization()
- extractRefining()
- extractRefiningDimensions()
- extractRefiningLocation()
- extractWebShopInfo()
- extractCountryOfOrigin()
- extractDeliveryTime()
- extractCustomsTariffNumber()
- extractTax()
- extractMustHaveImprint()
- extractMaxColors()
- extractPrintOptionGroup()
- (Plus others for default_products, battery_information, required_certificates if data exists)

---

### File 2: `variant-transformer.ts`

#### Current Issues:
1. ✅ Image extraction FIXED (primary_image + gallery_images)
2. ❌ Missing `short_description` extraction
3. ❌ Missing `meta_*` fields extraction
4. ❌ Missing `supplier_main_category` extraction
5. ❌ Material extraction needs Promidata structure support
6. ❌ Missing `country_of_origin` extraction
7. ❌ Missing `production_time` extraction
8. ❌ Missing `supplier_search_color` extraction
9. ❌ Missing `color` extraction from ConfigurationFields
10. ❌ Missing `size` extraction from ConfigurationFields

#### Fixes Required:

**Add to `transform()` method (around line 90):**
```typescript
short_description: this.extractShortDescription(variantData),
meta_name: this.extractMetaName(variantData),
meta_description: this.extractMetaDescription(variantData),
meta_keywords: this.extractMetaKeywords(variantData),
supplier_main_category: this.extractSupplierMainCategory(variantData),
material: this.extractMaterial(variantData), // FIX existing method
country_of_origin: this.extractCountryOfOrigin(variantData),
production_time: this.extractProductionTime(variantData),
supplier_search_color: this.extractSupplierSearchColor(variantData),
color: this.extractColorFromConfig(variantData),
size: this.extractSizeFromConfig(variantData),
```

**New/Updated extraction methods needed** (~10 methods, ~200 lines of code):
- extractShortDescription() - NEW
- extractMetaName() - NEW
- extractMetaDescription() - NEW
- extractMetaKeywords() - NEW
- extractSupplierMainCategory() - NEW
- extractMaterial() - UPDATE to support Promidata structure
- extractCountryOfOrigin() - NEW
- extractProductionTime() - NEW
- extractSupplierSearchColor() - NEW
- extractColorFromConfig() - NEW
- extractSizeFromConfig() - NEW

---

## Summary of Changes

### Total Missing Extractions:
- **Product**: 16 fields
- **ProductVariant**: 10 fields
- **Total**: 26 field extractions

### Code Changes Required:
1. **product-transformer.ts**: Add ~16 methods (~400 lines)
2. **variant-transformer.ts**: Add/update ~10 methods (~200 lines)
3. **Total new code**: ~600 lines

### Fields That Will Remain Empty (Expected):
- Product.brand (empty in Promidata A360)
- ProductVariant.hex_color (not provided)
- ProductVariant.supplier_color_code (not provided)
- ProductVariant.tron_logo_* (PromoAtlas-specific)
- ProductVariant.usb_item (may need inference logic)
- ProductVariant.fragile (not provided)
- ProductVariant.embroidery_sizes (not provided)

---

## Next Steps

1. ✅ Complete this analysis document
2. Implement product-transformer.ts fixes
3. Implement variant-transformer.ts fixes
4. Test with A360 re-sync
5. Verify all fields populate correctly
6. Document any remaining empty fields with reasons

---

**Created**: 2025-11-03
**Status**: Analysis complete, ready for implementation
