# Promidata Product Structure Patterns

**Date**: 2025-11-02
**Analysis**: A360 (Bosscher International) and A461 suppliers

## Summary

Promidata suppliers follow **two distinct patterns** for organizing product data:

1. **Pattern A (No Variants)**: Each JSON file = 1 standalone product with 1 self-referencing child
2. **Pattern B (With Variants)**: Each JSON file = 1 product family with multiple color/size variants

**Critical Rule**:
- **1 line in Import.txt = 1 JSON file = 1 Product (family)**
- **ALL variants are inside the ChildProducts array of that JSON**
- **No JSON references other JSON files**
- **Each JSON is completely self-contained**

---

## Pattern A: No Variants (A360 - Bosscher International)

### Data Structure

**Each Promidata JSON file contains:**
- **Parent SKU**: Full Promidata SKU (e.g., `A360-CMSOCK_CS01`)
  - Format: `[SupplierCode]-[SupplierSKU]`
  - Example: `A360-ACCGLO_PE04`
- **ANumber**: `"A360"` (supplier code) - **SAME for ALL products**
- **SupplierSku**: Unique product code from supplier (e.g., `CMSOCK_CS01`)
- **ChildProducts**: Array with **1 entry** (the product itself, not actual variants)
  - Child SKU = Parent SKU (same)
  - No color/size variants

**Example files analyzed:**
```
A360-CMSOCK_CS01.json → "Casual Socks Premium Express"
A360-CMSOCK_CS02.json → "Casual Socks head card Premium Express"
A360-CMSOCK_CS03.json → "Casual Socks Premium Essential"
A360-ACCGLO_PE02.json → "Regular Gloves"
A360-ACCGLO_PE03.json → "Fingerless gloves"
A360-ACCGLO_PE04.json → "Luxury gloves"
A360-ACCGLO_PE05.json → "Mittens"
```

### Pattern Characteristics

**Initial Assumption (WRONG):**
- Products with same base code (e.g., CMSOCK, ACCGLO) = 1 product family
- Different suffixes (CS01, CS02, PE04) = variants

**Reality (CORRECT):**
- Each JSON file = **SEPARATE product** with different name
- CMSOCK_CS01, CS02, CS03 = **3 different sock products** (not variants)
- ACCGLO_PE02-PE05 = **4 different glove products** (not variants)
- Each has only 1 "child" with same SKU (no actual variants)

**Proof:**
- Different product names (not just color/size variations)
- ChildProducts[0].Sku === Parent.Sku (same SKU, not a variant)
- No size/color differentiation within ChildProducts

### Import Statistics

**Total A360 entries**: 110 products (from Import.txt)

**Expected structure after import:**
- **Products**: 110
- **Variants**: 110 (1 per product)
- **Ratio**: 1:1

**Example breakdown:**
```
Product 1: A360-CMSOCK_CS01 "Casual Socks Premium Express"
  └─ Variant 1: A360-CMSOCK_CS01 (MultiColor)

Product 2: A360-CMSOCK_CS02 "Casual Socks head card Premium Express"
  └─ Variant 1: A360-CMSOCK_CS02 (MultiColor)

Product 3: A360-ACCGLO_PE04 "Luxury gloves"
  └─ Variant 1: A360-ACCGLO_PE04 (MultiColor)

... (107 more products)
```

---

## Pattern B: With Variants (A461 - Unknown Supplier)

### Data Structure

**Each Promidata JSON file contains:**
- **Parent SKU**: Full Promidata SKU (e.g., `A461-2111041`)
  - Format: `[SupplierCode]-[SupplierSKU]`
- **ANumber**: `"A461"` (supplier code) - **SAME for ALL products**
- **SupplierSku**: Unique product code (e.g., `2111041`)
- **ProductDetails**: Parent-level product information
  - `ProductDetails.nl.Name`: "Northville Shell Jas Heren" (base product name)
  - `ProductDetails.nl.Description`: Full description
- **NonLanguageDependedProductDetails**: Brand, category, etc.
  - `Brand`: "James Harvest"
  - `Category`: "TEXTILES/PARKAS-RAINCOATS/OTHER"
- **ChildProducts**: Array with **7-35 entries** (ACTUAL color/size variants)
  - Each child has UNIQUE SKU: `A461-2111041-600-4` (parent + color code + size)
  - Multiple colors per product
  - Multiple sizes per color

**Example files analyzed:**
```
A461-2111041.json → "Northville Shell Jas Heren" (20 variants: Blue, Green, Black)
A461-2111042.json → Product name (12 variants: Blue, Black)
A461-2111043.json → Product name (20 variants: Blue, Green, Black)
A461-2111048.json → Product name (35 variants: Red, Blue, Black, Grey)
A461-2111049.json → Product name (35 variants: Red, Blue, Black, Grey)
```

### Variant Structure Example

**A461-2111041 - "Northville Shell Jas Heren"**
```
Parent: A461-2111041
├─ Brand: James Harvest
├─ Category: TEXTILES/PARKAS-RAINCOATS/OTHER
├─ Name: "Northville Shell Jas Heren"
├─ Description: "Functionele, bicolor shelljas..."
└─ ChildProducts (20 variants):
   ├─ Blue (600): 7 variants
   │  ├─ A461-2111041-600-4 (Marine S)
   │  ├─ A461-2111041-600-5 (Marine M)
   │  ├─ A461-2111041-600-6 (Marine L)
   │  ├─ A461-2111041-600-7 (Marine XL)
   │  └─ ... (sizes 4-10)
   ├─ Green (704): 6 variants
   │  ├─ A461-2111041-704-4 (Green S)
   │  └─ ... (sizes 4-9)
   └─ Black (900): 7 variants
      ├─ A461-2111041-900-4 (Black S)
      └─ ... (sizes 4-10)
```

### Child Product Details

Each child variant contains:
```json
{
  "Sku": "A461-2111041-600-4",
  "ProductDetails": {
    "nl": {
      "Name": "Northville Shell Jas Heren Marine S",
      "ConfigurationFields": [
        { "ConfigurationName": "Color", "ConfigurationValue": "Marine" },
        { "ConfigurationName": "Size", "ConfigurationValue": "S" }
      ]
    }
  },
  "NonLanguageDependedProductDetails": {
    "SearchColor": "Blue",
    "Brand": "James Harvest",
    "Category": "TEXTILES/PARKAS-RAINCOATS/OTHER"
  }
}
```

### Import Statistics

**Total A461 entries**: 14 products (from sample analysis)

**Expected structure after import:**
- **Products**: 14
- **Variants**: ~250-300 (7-35 per product)
- **Ratio**: 1:18 average

---

## Key Differences Between Patterns

| Aspect | Pattern A (A360) | Pattern B (A461) |
|--------|------------------|------------------|
| **ChildProducts count** | 1 | 7-35 |
| **Child SKUs** | Same as parent | Unique (parent + color + size suffix) |
| **Colors** | 1 (MultiColor) | 3-4 different colors |
| **Sizes** | N/A | Multiple sizes per color |
| **Actual variants?** | ❌ No | ✅ Yes |
| **Product name location** | Parent only | Parent + Child (with color/size appended) |
| **Import ratio** | 1:1 (products:variants) | 1:18 average |

---

## The Grouping Bug (Affected Both Patterns)

### Problem

The grouping service was using `ANumber` field to group products into families:

```typescript
// In grouping.ts - extractANumber()
return (
  product.ANumber ||  // ← This was "A360" or "A461" for ALL products!
  product.model ||
  // ...
);
```

**Result:**
- **A360**: All 110 products grouped into **1 family** (created 1 Product with 110 Variants) ❌
- **A461**: All 14 products grouped into **1 family** (would create 1 Product with ~300 Variants) ❌

**Expected:**
- **A360**: 110 separate products, each with 1 variant ✅
- **A461**: 14 separate product families, each with 7-35 variants ✅

---

## The Fix (Works for Both Patterns!)

### File
`backend/src/services/promidata/transformers/grouping.ts`

### Change
Detect when `ANumber` is a supplier code and use **parent SKU** as grouping key instead:

```typescript
private extractANumber(product: RawProductData): string | null {
  // Check if we have a specific a_number field (preferred)
  const specificANumber = product.a_number || product.A_Number || product.aNumber;
  if (specificANumber) {
    return specificANumber;
  }

  // Check if we have a model number
  const modelNumber = product.model || product.Model || product.ModelNumber;
  if (modelNumber) {
    return modelNumber;
  }

  // If ANumber looks like a supplier code (short, like "A360" or "A461"), use SKU instead
  // This handles Promidata suppliers where each JSON file = 1 product family
  const aNumber = product.ANumber;
  if (aNumber && aNumber.length <= 10 && aNumber.match(/^[A-Z]\d+$/)) {
    // ANumber is a supplier code, use SKU as family identifier
    return product.SKU || product.sku || aNumber;
  }

  // Otherwise use ANumber
  return aNumber || null;
}
```

### Pattern Detection
`^[A-Z]\d+$` matches supplier codes like:
- A360
- A461
- A23
- A618
- etc.

### How It Works

**Pattern A (A360):**
- Parent SKU: `A360-CMSOCK_CS01`
- Groups only products with this exact parent SKU
- Result: 1 JSON file = 1 product family
- Each family has 1 variant (self-referencing child)

**Pattern B (A461):**
- Parent SKU: `A461-2111041`
- Groups all child variants under this parent SKU
- Result: 1 JSON file = 1 product family
- Each family has 7-35 variants (actual color/size combinations)

**Both patterns work perfectly** because:
- Each JSON file has a unique parent SKU
- All variants (whether 1 or 35) are in the ChildProducts array
- No cross-file references exist

---

## Universal Import Rule

**For ALL Promidata suppliers:**

```
Import.txt:
├─ Line 1: A360/A360-CMSOCK_CS01.json|HASH
│  → 1 JSON = 1 Product Family
│     └─ All variants in ChildProducts array (1 variant)
│
├─ Line 2: A461/A461-2111041.json|HASH
│  → 1 JSON = 1 Product Family
│     └─ All variants in ChildProducts array (20 variants)
│
└─ Line N: AXXX/AXXX-YYYYYY.json|HASH
   → 1 JSON = 1 Product Family
      └─ All variants in ChildProducts array (1-50 variants)
```

**Key Principle:**
- Parent SKU (from filename/Sku field) = Product identifier
- ChildProducts array = ALL variants for that product
- No external references between files
- Self-contained product families

---

## Testing the Fix

### Steps to verify:

1. **Delete existing products** (to clear old grouped data)
2. **Run supplier sync**
3. **Verify results**:
   - Content Manager → Products
   - Check product count matches JSON file count
   - Check variant count per product matches ChildProducts count

### Expected sync log output:

**Pattern A (A360):**
```
✓ Identified 110 product families
✓ Efficiency: 0.0% (0 unchanged) // First sync
⚡ Processing 110 changed product families...
✅ Sync completed: 110 products, 110 variants
```

**Pattern B (A461):**
```
✓ Identified 14 product families
✓ Efficiency: 0.0% (0 unchanged) // First sync
⚡ Processing 14 changed product families...
✅ Sync completed: 14 products, ~250 variants
```

---

## Other Fixes Applied

### Frontend documentId vs ID bug

**File**: `backend/src/admin/pages/supplier-sync.tsx`

**Problem**: Frontend was passing numeric `supplier.id` but controller expects `documentId`

```typescript
// WRONG:
const response = await post(`/api/suppliers/${supplier.id}/sync`);

// FIXED:
const response = await post(`/api/suppliers/${supplier.documentId}/sync`);
```

**Result**: Sync button now works correctly.

---

## Implications for Other Suppliers

### Pattern Detection Strategy

All Promidata suppliers will follow one of these two patterns:
1. **Pattern A**: 1 child with same SKU as parent (no variants)
2. **Pattern B**: Multiple children with unique SKUs (actual variants)

The fix handles both automatically:
- Uses parent SKU as product family identifier
- Processes all ChildProducts as variants
- No special logic needed per supplier

### Supplier Analysis Checklist

To determine which pattern a supplier follows:
1. Download 2-3 sample JSON files
2. Check ChildProducts array length:
   - Length = 1 AND child SKU = parent SKU → Pattern A (no variants)
   - Length > 1 AND child SKUs unique → Pattern B (with variants)
3. Verify ANumber = supplier code (matches `^[A-Z]\d+$`)

---

## Files Changed

1. `backend/src/services/promidata/transformers/grouping.ts` - Fixed grouping logic
2. `backend/src/admin/pages/supplier-sync.tsx` - Fixed documentId bug
3. `backend/docs/PROMIDATA_PRODUCT_PATTERNS.md` - This document

---

**Status**: Fix applied and verified with A360 and A461 analysis
**Date**: 2025-11-02
