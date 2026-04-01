# Promidata Product JSON -- Complete Field Map

*Generated: 2026-04-01*
*Source files analyzed:*
- `A23-100804.json` (189 KB, 2 children, supplier XD Collection, bags)
- `A130-893635.json` (172 KB, 6 children, supplier Premo BV, office)
- `A403-K3022IC.json` (844 KB, 48 children, supplier Kariban, clothing/t-shirts)
- `A73-49P.json` (270 KB, 20 children, supplier Buttonboss, caps/hats)

**Total unique JSON paths found: 723**

---

## Document Structure Overview

A Promidata product JSON has TWO levels:

1. **Root level** -- the "parent product" (product family). Identified by `Sku` like `A23-100804`.
2. **ChildProducts[]** -- the variants (size/color combos). Identified by `Sku` like `A23-100804-001`.

Both levels share an almost identical field structure. The key difference:
- **Root**: Aggregated/default data. `ImprintPositions` is always null. `NonLanguageDependedProductDetails` has zeroed dimensions/weight. `ProductPriceCountryBased` has the single lowest price tier.
- **Children**: Variant-specific data. `ImprintPositions` has the actual print positions. `NonLanguageDependedProductDetails` has real dimensions/weight. `ProductPriceCountryBased` has the full quantity-break price schedule.

---

## 1. ROOT-LEVEL FIELDS

Every field listed below appears in ALL 4 sample files unless noted.

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `ANumber` | string | `"A23"`, `"A130"`, `"A403"`, `"A73"` | Supplier code. Always present. |
| `Sku` | string | `"A23-100804"`, `"A130-893635"` | Format: `{ANumber}-{SupplierSku}`. Unique product family ID. |
| `SupplierSku` | string | `"100804"`, `"893635"`, `"K3022IC"`, `"49P"` | Supplier's own product code. |
| `Ean` | null | Always `null` at root level | EAN barcodes only on children. |
| `VideoUrl` | null | Always `null` in samples | Reserved for product video URLs. |
| `ChildHasErrors` | boolean | `false` | Whether any child product has errors. |
| `ChildProducts` | array | `[{...}, {...}]` | Array of variant objects. 2-48 items in samples. |
| `DefaultProducts` | object | `{"BENELUX": "A23-100804-001"}` | Maps region to default child SKU. |
| `ProductDetails` | object | `{"de": {...}, "nl": {...}, ...}` | Multilingual product info. See Section 3. |
| `NonLanguageDependedProductDetails` | object | `{...}` | Language-independent fields. See Section 4. |
| `ProductPriceCountryBased` | object | `{"BENELUX": {...}}` | Pricing by region. See Section 5. |
| `ProductPriceRegionBased` | null | Always `null` in samples | Alternative pricing (unused). |
| `ProductCosts` | null | Always `null` in samples | Internal cost data (unused). |
| `SamplePriceCountryBased` | null | Always `null` in samples | Sample pricing (unused). |
| `ImprintPositions` | null | Always `null` at root | Print positions only on children. |
| `ImprintReferences` | null | Always `null` in samples | Reserved for imprint refs. |
| `BatteryInformation` | null | Always `null` in samples | Reserved for battery info. |
| `ProductCertificates` | null | Always `null` in samples | Reserved for certifications. |
| `RequiredCertificates` | null | Always `null` in samples | Reserved for required certs. |
| `ForbiddenRegions` | null | Always `null` in samples | Reserved for region restrictions. |
| `UnstructuredInformation` | object | `{"ReleaseDate": "01.05.2025"}` | Dynamic key-value pairs. See Section 6. |
| `Errors` | object | `{}` | Error map, typically empty. |
| `Warnings` | object | `{}` | Warning map, typically empty. |

### DefaultProducts

Maps region keys to the default child product SKU for that region.

| Region Key | Example Value | Files |
|-----------|---------------|-------|
| `BENELUX` | `"A23-100804-001"` | A23 |
| `EURO` | `"A130-893635_01"`, `"A403-K3022ICC_80204_80187"` | A130, A403, A73 |

**Observation**: A23 (XD Collection) uses BENELUX region. A130, A403, A73 use EURO region. This matches the pricing regions.

---

## 2. CHILD PRODUCT FIELDS (ChildProducts[])

Each child has the same fields as root, PLUS additional ones:

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `Sku` | string | `"A23-100804-001"`, `"A403-K3022ICC_80204_80187"` | Unique variant SKU. |
| `SupplierSku` | string | `"100804-001"`, `"K3022ICC_80204_80187"` | Supplier's variant code. |
| `ANumber` | string | `"A23"` | Same as parent. Repeated per child. |
| `Ean` | string | `"8714612178119"`, `""`, `"3663938437897"` | EAN barcode. Can be empty string. |
| `VideoUrl` | null | Always `null` in samples | Reserved. |
| `ProductDetails` | object | `{...}` | Variant-specific multilingual data. See Section 3. |
| `NonLanguageDependedProductDetails` | object | `{...}` | Variant dimensions, weight, etc. See Section 4. |
| `ProductPriceCountryBased` | object | `{...}` | Full price schedule with quantity breaks. See Section 5. |
| `ProductPriceRegionBased` | null | Always `null` in samples | Alternative pricing (unused). |
| `ProductCosts` | null | Always `null` in samples | |
| `SamplePriceCountryBased` | null | Always `null` in samples | |
| `ImprintPositions` | array | `[{...}]` | Print positions and options. See Section 7. |
| `BatteryInformation` | null | Always `null` in samples | |
| `ProductCertificates` | null | Always `null` in samples | |
| `RequiredCertificates` | null | Always `null` in samples | |
| `ForbiddenRegions` | null | Always `null` in samples | |
| `UnstructuredInformation` | object | `{...}` | Dynamic key-value pairs. See Section 6. |
| `Errors` | object | `{}` | Typically empty. |
| `Warnings` | object | `{}` | Typically empty. |

---

## 3. ProductDetails (Multilingual Product Information)

`ProductDetails` is a language-keyed object. Each language key contains the full product description, images, configuration, and metadata for that language.

### Languages Observed

| Language Key | Full Name | Present In |
|-------------|-----------|------------|
| `nl` | Dutch | ALL files (A23, A130, A403, A73) |
| `de` | German | ALL files (A23, A130, A403, A73) |
| `en` | English | A23, A130, A73 (NOT in A403) |
| `fr` | French | A23, A130, A403 (NOT in A73) |

**CRITICAL**: Not every product has all 4 languages. The sync service MUST handle missing languages gracefully. NL and DE appear universal; EN and FR are supplier-dependent.

### ProductDetails.{lang} -- Fields per Language

| Field | Type | Example | Present | Notes |
|-------|------|---------|---------|-------|
| `Name` | string | `"Renew AWARE rPET Zippered Tote"` | Always | Product name in this language. |
| `Description` | string | `"A modern and sustainable..."` | Always | Full product description. May contain HTML (`<br />`). |
| `ShortDescription` | string/null | Always `null` in samples | Always | Reserved for short desc. |
| `MetaName` | string/null | Always `null` in samples | Always | SEO meta name. |
| `MetaDescription` | string/null | Always `null` in samples | Always | SEO meta description. |
| `MetaKeywords` | string/null | `"Sharpener,waste,bin,with,wheels"` or `null` | Always | Comma-separated keywords. A130 has them, A23/A403 null. |
| `Image` | object | `{"Url": "...", "Description": "", "FileName": "..."}` | Always | Primary product image. See Section 3.1. |
| `MediaGalleryImages` | array/null | `[{Url, Description, FileName}, ...]` or `null` | Always | Gallery images. Same structure as Image. Can be null or empty array. |
| `InformationFiles` | array/null | `[]` or `null` | Always | PDF/document attachments. Empty array in A403, null elsewhere. |
| `IsActive` | boolean | `true` | Always | Whether this language version is active. |
| `ConfigurationFields` | array/null | `[{...}]` | Always | At root level: always null. At child level: Color, Size configs. See Section 3.2. |
| `UnstructuredInformation` | object | `{...}` | Always | Language-specific unstructured data. See Section 3.3. |
| `WebShopInformation` | object | `{...}` | Always | Material, compliance, packaging info. See Section 3.4. |
| `PIMV1Information` | null | Always `null` | Always | Legacy PIM v1 data (unused). |
| `ImportantInformation` | object/null | `{"ImprintRequired": true, ...}` | Always | Imprint requirements. See Section 3.5. |

### 3.1 Image Object

Used for both `Image` (primary) and items in `MediaGalleryImages[]`.

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `Url` | string | `"https://images.promi-dl.de/Images/LiveR2/{guid}/{hash}.jpg"` | Full image URL. Always HTTPS. Can be .jpg or .png. |
| `Description` | string | `""` | Image alt text. Usually empty string. |
| `FileName` | string | `"100804-001__B_1__8cfaf9b1a15d422b8db22e711e722735.jpg"` | Original filename. Format varies by supplier. |

**URL Pattern**: `https://images.promi-dl.de/Images/LiveR2/{supplier-guid}/{content-hash}.{ext}`

**FileName conventions observed**:
- A23: `{supplierSku}__{type}_{num}__{guid}.{ext}` where type is B (beauty/main), S (swatch), D (detail)
- A130: `{supplierSku}.{ext}`
- A403: `PS_{productCode}_{COLOR}.{ext}` or `{productCode}-{num}_{year}.{ext}`
- A73: `{productCode}.{colorNum}.{ext}`

### 3.2 ConfigurationFields[]

Array of configuration/variant attributes. **Always null at root level.** Only populated on child products.

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `ConfigurationName` | string | `"Color"`, `"Size"`, `"49P_CONFIG_1"`, `"49P_CONFIG_2"` | Machine-readable config key. |
| `ConfigurationNameTranslated` | string | `"Colour"`, `"Farbe"`, `"Kleur"`, `"Größe"`, `"Bedrukking"`, `"Print"` | Human-readable name in this language. |
| `ConfigurationValue` | string | `"black (± PMS Black)"`, `"S"`, `"Donkergrijs"`, `"Borduring 12x2 cm"` | The variant value. |

**Configuration patterns observed**:
- **A23**: 1 config: `Color` only (no sizes -- it's a bag)
- **A130**: 1 config: `Color` only (pencil sharpener)
- **A403**: 2 configs: `Size` + `Color` (clothing)
- **A73**: 2 configs: supplier-specific names (`49P_CONFIG_1` = print method, `49P_CONFIG_2` = color)

**IMPORTANT**: ConfigurationName is NOT always standard. A73 uses product-specific config names instead of `"Color"`. The translated name reveals the actual meaning.

### 3.3 UnstructuredInformation (Language-Specific)

Located at `ProductDetails.{lang}.UnstructuredInformation`. Dynamic key-value object. Keys vary by supplier.

| Key | Type | Example | Present In | Notes |
|-----|------|---------|-----------|-------|
| `SupplierMainCategory` | string | `"Bags & Travel/Carry shopping bags"`, `"OFFICE/PENCILS_CRAYONS_MARKERS"` | ALL files | Supplier's own category path. Language-specific translations. |
| `SupplierSearchColor` | string | `"black"`, `"BLUE"`, `"Zwart"`, `"Schwarz"` | A23, A130, A403 | Color name in this language. NOT always present. |
| `SupplierColorCode` | string | `"893635_01_COLOR"` | A130 only | Supplier's color code. |
| `SupplierAdditionalCategories` | string | `""` | A130, A73 | Additional categories. Usually empty. At root level can be null. |
| `PMSValue` | string | `"Black"`, `"navy"` | A23, A403 | Pantone Matching System color value. |
| `HexColor` | string | `"232325"` | A403 only | Hex color code (NO # prefix). |

**IMPORTANT**: `HexColor` can appear in TWO places:
1. `ProductDetails.{lang}.UnstructuredInformation.HexColor` -- A403 has it here (same value across all languages)
2. `NonLanguageDependedProductDetails.HexColor` -- Always null in our samples

Currently the hex color is only found in the language-specific UnstructuredInformation, not in the language-independent section.

### 3.4 WebShopInformation (Language-Specific)

Located at `ProductDetails.{lang}.WebShopInformation`. Object with dynamic keys. Each key contains `{InformationLabel, InformationValue}`.

| Key | InformationLabel (en) | InformationValue Example | Present In | Notes |
|-----|----------------------|-------------------------|-----------|-------|
| `Material` | `"Material"` | `"rPET, rPET"`, `"Plastic"`, `"Cotton"` | ALL files | Product material(s). Always present. |
| `Compliance` | `"Compliance"` | `"Conform AZO dye..."` (long comma-separated list) | A23 only | Regulatory compliance info. |
| `PackagingInformation` | `"Packaging Information"` | `"Bulk"` | A23 only | Packaging type. |
| `CountryOfOrigin` | `"Country of Origin"` | `"CN"` | A73 only | ISO country code. |
| `Fit` | `"Fit"` (de: `"Passform"`) | `"Straight"` | A403 only | Clothing fit type. |
| `RefiningInfoText` | `"Refining"` | `"Pad printing simple"` | A130 only | Print method description. |
| `RefiningDimensionText` | `"Refining dimension"` | `"20x30 mm"` | A130 only | Print area dimensions. |
| `RefiningLocationText` | `"Refining location"` | `"front side"` | A130 only | Print position. |

**Structure of each WebShopInformation entry**:
```json
{
  "Material": {
    "InformationLabel": "Material",       // Translated label
    "InformationValue": "rPET, rPET"      // Translated value
  }
}
```

**IMPORTANT**: Keys are dynamic and supplier-dependent. New keys may appear with new suppliers. The `InformationLabel` is translated per language; the key name itself is NOT translated.

### 3.5 ImportantInformation

Located at `ProductDetails.{lang}.ImportantInformation`. Can be null (A23, A403 at some children) or an object.

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `ImprintRequired` | boolean | `true`, `false` | Whether imprint/branding is required for this product. |
| `TronLogoEnabled` | boolean | `false` | Whether Tron logo is enabled. Always false in samples. |
| `TronLogoReference` | string/null | Always `null` | Reference to Tron logo. |

Present in: A130 (all children), A73 (all children). Null in: A23, A403 (some or all).

---

## 4. NonLanguageDependedProductDetails

Language-independent product attributes. Present at BOTH root and child level.

### Fields (Always Present at Both Levels)

| Field | Type | Root Value | Child Value | Notes |
|-------|------|-----------|-------------|-------|
| `LogoToolImageDefined` | null | Always `null` | Always `null` | Reserved for logo tool. |
| `SearchColor` | string | `"Undefined"` | `"Black"`, `"Blue"`, `"MultiColor"` | Standardized color name. Root always "Undefined". |
| `HexColor` | null | Always `null` | Always `null` | Reserved but unused in samples. See UnstructuredInformation for actual hex. |
| `Fragile` | boolean | `false` | `false` | Whether product is fragile. |
| `Category` | string | `"BAGS/SHOPPING_BAGS"` | `"BAGS/SHOPPING_BAGS"` | Promidata category path using `/` separator. |
| `SecondaryCategories` | array/null | `[]` | `null` | Additional categories. Empty array at root, null at child. |
| `CountryOfOrigin` | string/null | Always `null` at root | `"CHN"`, `"BD"`, `"CN"`, `null` | ISO country code. Only at child level. Two formats: ISO 3166-1 alpha-2 (CN) or alpha-3 (CHN, BD). |
| `ProductFiltersByGroup` | object/null | Always `null` at root | `{"Eco": "True"}`, `{"GenderType": "Male"}` | Dynamic filter flags. See Section 4.1. |
| `Weight` | integer | `0` at root | `175`, `20`, `86` | Weight in grams. Root always 0. |
| `DimensionsLength` | integer | `0` at root | `280`, `40` | Length in mm. |
| `DimensionsHeight` | integer | `0` at root | `381`, `62` | Height in mm. |
| `DimensionsWidth` | integer | `0` at root | `127`, `41` | Width in mm. |
| `DimensionsDiameter` | integer | `0` | `0` | Diameter in mm. |
| `DimensionsDepth` | integer | `0` | `0` | Depth in mm. |
| `Brand` | string | `"XD Collection"`, `""`, `"Kariban"`, `"Kingcap"` | Same at root & child | Brand name. Can be empty string. |
| `USBItem` | boolean | `false` | `false` | Whether product is USB-related. |
| `CustomsTariffNumber` | string/null | Always `null` at root | `"4202929190"`, `"82141000"`, `"61091000"`, `"65050030"` | HS tariff code. Only at child level. |

### Fields ONLY at Child Level

| Field | Type | Example | Present In | Notes |
|-------|------|---------|-----------|-------|
| `OuterCartonLengthCM` | float | `47.0` | A23 only | Shipping carton length in cm. |
| `OuterCartonWidthCM` | float | `37.0` | A23 only | Shipping carton width in cm. |
| `OuterCartonHeightCM` | float | `39.0` | A23 only | Shipping carton height in cm. |
| `OuterCartonWeightNetKG` | float | `15.8` | A23 only | Net carton weight in kg. |
| `OuterCartonWeightGrossKG` | float | `16.8` | A23 only | Gross carton weight in kg. |
| `OuterCartonQuantityPerCarton` | integer | `90` | A23 only | Units per outer carton. |
| `WebShopInformation` | object | `{"MaterialWeight": "140 g/m2"}` | A23, A403 | Non-translated webshop info. See Section 4.2. |

### 4.1 ProductFiltersByGroup (Dynamic)

Object with string values. Keys vary by supplier. Only present at child level (null at root).

| Key | Value | Present In | Notes |
|-----|-------|-----------|-------|
| `Eco` | `"True"` | A23 | Eco-friendly product flag. |
| `CustomSleevePossible` | `"True"` | A23 | Custom sleeve printing available. |
| `GiftWrappingPossible` | `"True"` | A23 | Gift wrapping available. |
| `GenderType` | `"Male"` | A403 | Target gender for clothing. |

**NOTE**: Values are strings `"True"`/`"False"`, NOT booleans.

### 4.2 NonLanguageDependedProductDetails.WebShopInformation (Child-Only)

Non-translated webshop metadata. Keys vary by supplier.

| Key | Type | Example | Present In | Notes |
|-----|------|---------|-----------|-------|
| `OuterBoxDimension` | string | `"47 x 37 x 39 cm"` | A23 | Outer box dimensions formatted. |
| `OuterCartonDimension` | string | `"47 x 37 x 39 cm"` | A23 | Same as OuterBoxDimension. |
| `OuterCartonQuantityPerCarton` | string | `"90"` | A23 | Same as numeric field but as string. |
| `OuterCartonWeightNetKG` | string | `"15.8"` | A23 | Same as numeric field but as string. |
| `OuterCartonWeightGrossKG` | string | `"16.8"` | A23 | Same as numeric field but as string. |
| `MaterialWeight` | string | `"140 g/m2"` | A403 | Fabric weight (for textiles). |

---

## 5. ProductPriceCountryBased (THE PRICING STRUCTURE)

This is the most critical section. Pricing is organized by REGION, then by PRICE TYPE, with quantity-break tiers.

### Region Keys

| Region | Currency | Present In | Notes |
|--------|----------|-----------|-------|
| `BENELUX` | `"EURO"` | A23 only | Belgium/Netherlands/Luxembourg region. |
| `EURO` | `"EURO"` | A130, A403, A73 | Generic European/Eurozone region. |

**NOTE**: We have only seen 2 region keys across 4 suppliers. More regions likely exist (DACH, UK, NORDICS, etc.) with other suppliers.

### Region Object Structure

Each region contains:

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `RecommendedSellingPrice` | array | `[{Price, Quantity, OnRequest, Valuta}, ...]` | Recommended selling prices. See Price Tier below. |
| `GeneralBuyingPrice` | array | `[{Price, Quantity, OnRequest, Valuta}, ...]` | Dealer/buying prices. Can be empty `[]`. |
| `QuantityIncrements` | integer | `1` | Order quantity must be multiple of this. |
| `VatPercentage` | integer | `0` | VAT percentage (0 = VAT excluded). |
| `MinimumOrderQuantity` | integer | `1`, `100` | Minimum order quantity. |
| `VatSettingId` | integer | `0`, `1` | VAT configuration reference. |

### Price Tier Object (RecommendedSellingPrice[] / GeneralBuyingPrice[])

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `Price` | float | `8.98`, `0.0` | Unit price at this quantity. `0.0` means on-request or free. |
| `Quantity` | integer | `1`, `50`, `100`, `250`, `500`, `1000`, `2500`, `5000`, `10000` | Minimum quantity for this price tier. |
| `OnRequest` | boolean | `false`, `true` | If true, price must be requested (not fixed). |
| `Valuta` | string | `"EURO"` | Currency code. Always EURO in samples. |

### Pricing Comparison: Root vs Child

**Root level** ProductPriceCountryBased typically contains ONLY the lowest price tier (the highest quantity break price):
- A23 root: 1 tier at Qty=1500, Price=7.95
- A130 root: 1 tier at Qty=10000, Price=1.15
- A403 root: 1 tier at Qty=1, Price=5.66

**Child level** has the FULL quantity-break schedule:
- A23 child: 6 tiers (Qty 1, 100, 250, 500, 1000, 1500)
- A130 child: 6 tiers (Qty 100, 250, 500, 2500, 5000, 10000)
- A403 child: 1 tier (Qty 1)
- A73 child: 1 tier (Qty 1)

**IMPORTANT**: Always use CHILD-level pricing for the complete price schedule. Root-level pricing is just a summary.

### Price Types

| Type | Description | Has Data In |
|------|-------------|------------|
| `RecommendedSellingPrice` | Recommended retail price | ALL files |
| `GeneralBuyingPrice` | Wholesale/dealer buying price | A23 (BENELUX), A130 (EURO). Empty array in A403, A73. |

**NOTE**: GeneralBuyingPrice may have more tiers than RecommendedSellingPrice (A130 has 7 buying tiers vs 6 selling tiers).

---

## 6. UnstructuredInformation (Dynamic Key-Value Pairs)

Both root and child level have UnstructuredInformation. Keys vary by supplier.

### Root-Level UnstructuredInformation

| Key | Type | Example | Present In | Notes |
|-----|------|---------|-----------|-------|
| `ReleaseDate` | string | `"01.05.2025"` | A23 | Product release date (DD.MM.YYYY format). |
| `LeakPrevention` | string | `"True"` | A23 | Product feature flag (string, not boolean). |
| `SupplierMainCategory` | string | `"OFFICE/PENCILS_CRAYONS_MARKERS"` | A130, A73 | Supplier category path. |
| `DeliveryTimeInfoText` | string | `"12"`, `"10"` | A130, A73 | Delivery time description (days as string). |
| `DeliveryTimeInDays` | string | `"12"`, `"10"` | A130, A73 | Delivery time in days (string). |
| `SupplierNameToShow` | string | `"Premo BV"`, `"Buttonboss"` | A130, A73 | Display name for the supplier. |

**NOTE**: A403 has an EMPTY UnstructuredInformation at root (`{}`). A23 has product-specific fields. A130/A73 have supplier metadata.

### Child-Level UnstructuredInformation

Same keys as root (when present), plus identical content. The child-level copy is redundant with the root-level for most keys.

---

## 7. ImprintPositions (Print/Customization Data)

**Only present at CHILD level.** Always null at root level.

Array of imprint position objects, each defining WHERE and HOW the product can be customized.

### ImprintPositions[] Object

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `PositionCode` | string | `"item front_150x150mm"`, `"LOC_1269407534"`, `"ONPRODUCT"` | Machine-readable position identifier. Format varies by supplier. |
| `SupplierPositionCode` | string | `"item front"` | Supplier's internal position code. **ONLY in A23.** |
| `ImprintLocationTexts` | object | `{"de": {...}, "nl": {...}, ...}` | Multilingual location descriptions. See 7.1. |
| `UnstructuredInformation` | object/null | `{"MaxPrintArea": "150 x 150 mm"}` or `null` | Additional position metadata. |
| `ImprintOptions` | array | `[{...}, ...]` | Available print techniques. See 7.2. |

### 7.1 ImprintLocationTexts.{lang}

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `Name` | string | `"item front (max 150 x 150 mm)"`, `"front side"`, `"Auf Produkt"` | Human-readable position name. |
| `Description` | null | Always `null` | Reserved for position description. |
| `Images` | array/null | `[{Url, Description, FileName}]` or `null` | Position illustration images. Same structure as product Image. |

**Languages in ImprintLocationTexts**: Follows the same language keys as the product (nl, de, en, fr). Not all languages may be present.

### 7.2 ImprintOptions[] (Print Techniques)

Each ImprintOption defines a printing method available at this position.

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `Sku` | string | `"A23-SCREEN_TRANSFER_OS_1C"`, `"A130-TA_A_1C"`, `"A73-BL-Sales"` | Imprint option SKU. |
| `SupplierSku` | string | `"SCREEN_TRANSFER_OS_1C"`, `"TA_A_1C"`, `"BL-Sales"` | Supplier's imprint code. |
| `ImprintTexts` | object | `{"de": {"Name": "...", "Description": null}, ...}` | Multilingual print technique name. |
| `PrintColor` | integer | `0` | Number of colors (always 0 in samples -- may be unused). |
| `PrintColorAsText` | null | Always `null` | Reserved for color text. |
| `Dimension` | null | Always `null` | Reserved for dimension info. |
| `DimensionsHeight` | integer | `0` | Imprint height in mm. All 0 in samples. |
| `DimensionsWidth` | integer | `0` | Imprint width in mm. All 0 in samples. |
| `DimensionsDiameter` | integer | `0` | Imprint diameter in mm. |
| `DimensionsDepth` | integer | `0` | Imprint depth in mm. |
| `ImprintType` | null | Always `null` | Reserved for imprint type classification. |
| `FastEditorNumberOfColors` | string | `"1"`, `"2"`, `"3"` | Number of colors for this technique. **ONLY in A23.** String, not integer. |
| `SupplierPrintCode` | string | `"Screen Transfer OS"` | Supplier's print technique group code. **ONLY in A23.** |
| `ProductPriceCountryBased` | object | `{"BENELUX": {...}}` | Per-unit printing price with quantity breaks. Same structure as Section 5. |
| `ProductPriceRegionBased` | null | Always `null` | |
| `ImprintCosts` | array/null | `[{...}]` or `null` | One-time setup/fixed costs. See 7.3. Can be null (A403) or empty. |
| `IsActiveRegionBased` | null | Always `null` | |
| `IsActiveCountryBased` | null | Always `null` | |
| `ImportantInformation` | null | Always `null` | |
| `ChildImprints` | null | Always `null` | Reserved for nested imprints. |
| `UnstructuredInformation` | object/null | `{"SupplierNameToShow": "Premo BV"}` or `null` | Additional metadata. |

### 7.2.1 ImprintTexts.{lang}

| Field | Type | Example |
|-------|------|---------|
| `Name` | string | `"Screen transfer 1 color"`, `"Pad printing, 1 colour"`, `"Tampographie , 2 couleurs"` |
| `Description` | null | Always null. |

### 7.3 ImprintCosts[] (Setup/Fixed Costs)

One-time costs associated with an imprint option (e.g., screen setup, embroidery digitization).

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `Sku` | string | `"A23-SCREEN_TRANSFER_OS_1C_S"`, `"A130-TA_A_1C-C1"` | Cost item SKU. |
| `SupplierSku` | string/null | `"SCREEN_TRANSFER_OS_1C_S"` or `null` | Supplier's cost item code. Can be null (A130). |
| `Texts` | object | `{"de": {"Name": "Einrichtungskosten", "Description": null}, ...}` | Multilingual cost name. |
| `ProductPriceCountryBased` | object | `{"BENELUX": {...}}` | Cost amount (same pricing structure). Usually 1 tier at Qty=1. |
| `ProductPriceRegionBased` | null | Always `null` | |
| `IsActiveRegionBased` | null | Always `null` | |
| `IsActiveCountryBased` | null | Always `null` | |
| `CalculationType` | string | `"Unique"` | How cost is calculated. Always "Unique" in samples (one-time). |
| `CalculationAmount` | integer | `1` | Calculation multiplier. |
| `Requirement` | object/null | `{"Operator": "Always", "Amount": 0}` or `null` | When this cost applies. |
| `UnstructuredInformation` | null | Always `null` | |

### 7.3.1 Requirement Object

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `Operator` | string | `"Always"` | When the cost applies. Only seen "Always". |
| `Amount` | integer | `0` | Threshold amount. 0 with "Always" = always required. |

---

## 8. SUMMARY: Key Data Extraction Patterns

### For Product Family (Root)

```
Sku              → Product family SKU
ANumber          → Supplier code
SupplierSku      → Supplier's product code
ProductDetails   → Multilingual name, description, images
  .{lang}.Name
  .{lang}.Description
  .{lang}.Image.Url
  .{lang}.WebShopInformation.Material.InformationValue
NonLanguageDependedProductDetails
  .Brand
  .Category
```

### For Variants (Children)

```
ChildProducts[].Sku           → Variant SKU
ChildProducts[].Ean           → EAN barcode
ChildProducts[].ProductDetails.{lang}
  .ConfigurationFields[]      → Color, Size, etc.
  .Image.Url                  → Variant-specific image
  .MediaGalleryImages[]       → Gallery
  .UnstructuredInformation.HexColor  → Hex color (if available)
ChildProducts[].NonLanguageDependedProductDetails
  .SearchColor                → Standardized color name
  .Weight                     → Weight in grams
  .DimensionsLength/Height/Width  → Dimensions in mm
  .CountryOfOrigin            → ISO country code
  .CustomsTariffNumber        → HS tariff code
ChildProducts[].ProductPriceCountryBased
  .{REGION}.RecommendedSellingPrice[]  → Selling prices
  .{REGION}.GeneralBuyingPrice[]       → Buying prices
  .{REGION}.MinimumOrderQuantity       → MOQ
ChildProducts[].ImprintPositions[]     → Print positions & techniques
```

### Fields That Differ Between Root and Child

| Aspect | Root | Child |
|--------|------|-------|
| Ean | Always null | String (can be empty) |
| ConfigurationFields | Always null | Array of Color/Size/etc. |
| ImprintPositions | Always null | Array of positions |
| NonLanguageDependedProductDetails.SearchColor | `"Undefined"` | Actual color |
| NonLanguageDependedProductDetails.Weight | `0` | Actual weight (grams) |
| NonLanguageDependedProductDetails.Dimensions* | All `0` | Actual values (mm) |
| NonLanguageDependedProductDetails.CountryOfOrigin | `null` | ISO code |
| NonLanguageDependedProductDetails.CustomsTariffNumber | `null` | HS code string |
| NonLanguageDependedProductDetails.ProductFiltersByGroup | `null` | Filter flags |
| NonLanguageDependedProductDetails.SecondaryCategories | `[]` (empty array) | `null` |
| ProductPriceCountryBased | 1 tier (lowest price) | Full quantity-break schedule |
| ImportantInformation | Always null | Imprint required flag |
| OuterCarton* fields | Not present | Present (A23 only) |
| WebShopInformation (in NLD) | Not present | Present (A23, A403) |

---

## 9. FIELD PRESENCE MATRIX BY FILE

| Feature/Field | A23 (bags) | A130 (office) | A403 (clothing) | A73 (caps) |
|--------------|-----------|--------------|----------------|-----------|
| Languages | de, fr, en, nl | nl, de, en, fr | nl, de, fr | nl, de, en |
| Region key | BENELUX | EURO | EURO | EURO |
| GeneralBuyingPrice data | Yes (6 tiers) | Yes (7 tiers) | No (empty) | No (empty) |
| Child configs | Color | Color | Size + Color | Custom (49P_CONFIG_1, 49P_CONFIG_2) |
| MediaGalleryImages | Yes (5 per child) | null | Yes (4-8 per child) | null |
| HexColor (in UnstructuredInfo) | No | No | Yes ("232325") | No |
| OuterCarton fields | Yes (6 fields) | No | No | No |
| ProductFiltersByGroup | Eco, CustomSleeve, GiftWrapping | null | GenderType | null |
| ImportantInformation | null | ImprintRequired=true | null | ImprintRequired=false |
| Imprint positions per child | 1 pos, 12 options | 1 pos, 2 options | 1 pos, 1 option | 1 pos, 1 option |
| FastEditorNumberOfColors | Yes ("1"-"3") | No | No | No |
| SupplierPrintCode | Yes | No | No | No |
| SupplierPositionCode | Yes | No | No | No |
| ImprintCosts | Yes (1 per option) | Yes (1 per option) | null | Yes (0-2 per option) |
| ReleaseDate | Yes | No | No | No |
| DeliveryTimeInDays | No | Yes | No | Yes |
| SupplierNameToShow | No | Yes (root + child) | No | Yes (root + child) |
| MaterialWeight (NLD.WebShopInfo) | No | No | Yes | No |
| Compliance (WebShopInfo) | Yes | No | No | No |
| Fit (WebShopInfo) | No | No | Yes | No |
| RefiningInfoText (WebShopInfo) | No | Yes | No | No |
| MetaKeywords | null | Yes | null | empty string |
| Children count | 2 | 6 | 48 | 20 |

---

## 10. NOTES FOR SYNC SERVICE IMPLEMENTATION

1. **Language handling**: Always check for language key existence before accessing. Not all products have EN or FR. NL and DE are the most reliable.

2. **Price region**: Use the first available region key from ProductPriceCountryBased. Don't hardcode "BENELUX" or "EURO".

3. **HexColor**: Check TWO locations:
   - `NonLanguageDependedProductDetails.HexColor` (usually null)
   - `ProductDetails.{any_lang}.UnstructuredInformation.HexColor` (A403 has it here)

4. **Configuration parsing**: Don't assume `ConfigurationName` is always `"Color"` or `"Size"`. Use `ConfigurationNameTranslated` for hints, or check all configs.

5. **Null vs empty**: Many array fields can be either `null` or `[]`. Both mean "no data". Handle both.

6. **String booleans**: ProductFiltersByGroup values are strings (`"True"`) not booleans. Parse accordingly.

7. **Root vs child**: Always use CHILD-level data for dimensions, weight, country of origin, customs tariff, and full price schedule. Root level has zeroed/minimal versions.

8. **Price tiers vary**: A23 has 6 selling + 6 buying tiers. A130 has 6 selling + 7 buying tiers. A403/A73 have just 1 selling tier + 0 buying. Tier count is not fixed.

9. **Image URLs**: All come from `images.promi-dl.de`. The GUID in the path identifies the supplier account. The hash identifies the image content.

10. **Empty strings vs null**: Ean can be empty string `""` (A130, A73) or a real barcode (A23, A403). Brand can be empty string. Always check for both `null` and `""`.
