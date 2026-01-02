# PromoAtlas Chat UI Integration Guide

*Last updated: 2025-12-05*

Guide for integrating a chat UI with PromoAtlas product search using **Gemini FileSearchStore** (semantic AI search) and **Meilisearch** (product data).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR CHAT UI                                │
└─────────────────────────────────────────────────────────────────────┘
                    │                           │
                    │ 1. Semantic Search        │ 2. Get Product Data
                    ▼                           ▼
        ┌───────────────────┐       ┌───────────────────────┐
        │  Gemini FileSearch │       │      Meilisearch      │
        │  (AI understands   │       │  (actual product data │
        │   user intent)     │       │   prices, images...)  │
        └───────────────────┘       └───────────────────────┘
```

### Why Two Services?

| Service | Purpose | Example |
|---------|---------|---------|
| **Gemini** | Understands natural language queries | "eco-friendly bags for conferences under €5" |
| **Meilisearch** | Returns accurate product data | Exact prices, image URLs, specs |

**Key Principle**: AI finds products semantically, but you **display data from Meilisearch** to prevent hallucinations.

---

## Environment Variables

```bash
# ═══════════════════════════════════════════════════════════════════
# GEMINI (Semantic Search)
# ═══════════════════════════════════════════════════════════════════

# API Key - Get from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...your_key_here

# ═══════════════════════════════════════════════════════════════════
# MEILISEARCH (Product Data)
# ═══════════════════════════════════════════════════════════════════

# Meilisearch instance URL
MEILISEARCH_HOST=https://search.sols.mk

# Search API Key (read-only, safe for frontend)
# Ask Neno for this key or check 1Password
MEILISEARCH_SEARCH_KEY=your_search_api_key_here

# Index name (always use this)
MEILISEARCH_INDEX_NAME=pim_products
```

---

## Part 1: Gemini FileSearchStore (Semantic Search)

### Store Details

- **Store ID**: `fileSearchStores/promoatlas-product-catalog-xfex8hxfyifx`
- **Store Name**: `PromoAtlas Product Catalog`
- **Content**: ~1000+ promotional products as JSON documents
- **Languages**: EN, DE, FR, ES (multilingual product data)

### Installation

```bash
npm install @google/genai
```

### Basic Query Example

```typescript
import { GoogleGenAI } from '@google/genai';

// Initialize client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// The FileSearchStore ID (constant - don't change)
const STORE_ID = 'fileSearchStores/promoatlas-product-catalog-xfex8hxfyifx';

async function semanticProductSearch(userQuery: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',  // or 'gemini-1.5-pro' for complex queries
    contents: userQuery,
    config: {
      tools: [{
        fileSearch: {
          fileSearchStoreNames: [STORE_ID]  // ⚠️ MUST be "Names" not "Ids"
        }
      }]
    }
  });

  return response;
}

// Example usage
const result = await semanticProductSearch(
  'Find me sustainable promotional items for a tech conference, budget around €3-5 per item'
);
```

### ⚠️ Critical: API Format

```typescript
// ✅ CORRECT - This works
config: {
  tools: [{
    fileSearch: {
      fileSearchStoreNames: [STORE_ID]  // "Names" plural
    }
  }]
}

// ❌ WRONG - This will NOT find any products
tools: [{
  fileSearch: {
    fileSearchStoreIds: [STORE_ID]  // "Ids" does NOT work
  }
}]
```

### What Gemini Returns

Gemini will respond with natural language that references products from the catalog. The AI has access to:

- Product names (multilingual)
- Descriptions and materials
- Available colors and sizes
- Price ranges
- Supplier information
- Category information

**Example AI Response**:
> "Based on your requirements for sustainable tech conference items under €5, I found several options:
> 1. **Recycled Notebook A407-2030** - Made from recycled paper, available in 5 colors, €2.50-€4.00
> 2. **Bamboo Pen Set A109-1234** - Eco-friendly bamboo, €3.20..."

### Extracting Product IDs from AI Response

You'll need to parse the AI response to extract product identifiers (SKU or a_number), then fetch full data from Meilisearch:

```typescript
// Simple regex to find A-numbers (e.g., A407-2030)
function extractProductIds(aiResponse: string): string[] {
  const pattern = /A\d{2,3}-\d{4}/g;
  const matches = aiResponse.match(pattern) || [];
  return [...new Set(matches)]; // Remove duplicates
}

// Or extract SKUs if present
function extractSkus(aiResponse: string): string[] {
  const pattern = /SKU[:\s]+([A-Z0-9-]+)/gi;
  const matches = [...aiResponse.matchAll(pattern)];
  return matches.map(m => m[1]);
}
```

---

## Part 2: Meilisearch (Product Data)

Once you have product identifiers from Gemini, fetch the **actual data** from Meilisearch.

### Installation

```bash
npm install meilisearch
```

### Initialize Client

```typescript
import { MeiliSearch } from 'meilisearch';

const meilisearch = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST,      // https://search.sols.mk
  apiKey: process.env.MEILISEARCH_SEARCH_KEY
});

const index = meilisearch.index('pim_products');
```

### Search Products

```typescript
// Basic text search
const results = await index.search('recycled notebook', {
  limit: 20,
  filter: 'is_active = true'
});

console.log(results.hits);  // Array of products
```

### Filter by Product IDs (from Gemini)

```typescript
// After extracting A-numbers from Gemini response
const aNumbers = ['A407-2030', 'A109-1234', 'A360-5678'];

const results = await index.search('', {
  filter: `a_number IN [${aNumbers.map(n => `"${n}"`).join(', ')}]`,
  limit: 50
});
```

### Product Document Structure

Each product in Meilisearch has this structure:

```typescript
interface MeilisearchProduct {
  // Identifiers
  id: string;              // Strapi documentId (UUID)
  sku: string;             // e.g., "A407-2030-BLK-M"
  a_number: string;        // Product family, e.g., "A407-2030"

  // Multilingual names (flattened)
  name_en?: string;
  name_de?: string;
  name_fr?: string;
  name_es?: string;

  // Multilingual descriptions
  description_en?: string;
  description_de?: string;
  description_fr?: string;
  description_es?: string;

  // Supplier info
  supplier_name: string;
  supplier_code: string;   // e.g., "A407"
  brand?: string;

  // Variants (aggregated)
  colors: string[];        // ["Black", "Blue", "Red"]
  sizes: string[];         // ["S", "M", "L", "XL"]
  hex_colors: string[];    // ["#000000", "#0000FF", "#FF0000"]
  total_variants_count: number;

  // Pricing
  price_min?: number;      // Lowest tier price
  price_max?: number;      // Highest tier price
  currency: string;        // Usually "EUR"

  // Categories
  category?: string;       // Primary category name
  category_codes: string[];

  // Images (direct URLs to Cloudflare R2)
  main_image_url?: string;
  main_image_thumbnail_url?: string;

  // Status
  is_active: boolean;

  // Metadata
  country_of_origin?: string;
  delivery_time?: string;
  material_en?: string;
  material_de?: string;
  // ... other material languages
}
```

### Available Filters

```typescript
// Filter by status
filter: 'is_active = true'

// Filter by supplier
filter: 'supplier_code = "A407"'

// Filter by price range
filter: 'price_min >= 2 AND price_max <= 10'

// Filter by color (array contains)
filter: 'colors = "Blue"'

// Filter by multiple colors
filter: 'colors IN ["Blue", "Red", "Green"]'

// Filter by category
filter: 'category_codes = "BAGS"'

// Combine multiple filters
filter: 'is_active = true AND price_min >= 1 AND price_max <= 5 AND colors = "Blue"'
```

### Sorting Options

```typescript
// Sort by newest first
sort: ['updatedAt:desc']

// Sort by price (cheapest first)
sort: ['price_min:asc']

// Sort by price (most expensive first)
sort: ['price_max:desc']

// Sort alphabetically by brand
sort: ['brand:asc']
```

### Complete Search Example

```typescript
const searchProducts = async (query: string, options?: {
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
  suppliers?: string[];
  limit?: number;
  offset?: number;
}) => {
  // Build filter array
  const filters: string[] = ['is_active = true'];

  if (options?.colors?.length) {
    filters.push(`colors IN [${options.colors.map(c => `"${c}"`).join(', ')}]`);
  }

  if (options?.minPrice !== undefined) {
    filters.push(`price_min >= ${options.minPrice}`);
  }

  if (options?.maxPrice !== undefined) {
    filters.push(`price_max <= ${options.maxPrice}`);
  }

  if (options?.suppliers?.length) {
    filters.push(`supplier_code IN [${options.suppliers.map(s => `"${s}"`).join(', ')}]`);
  }

  const results = await index.search(query, {
    filter: filters.join(' AND '),
    limit: options?.limit || 20,
    offset: options?.offset || 0,
    sort: ['updatedAt:desc'],
    attributesToRetrieve: [
      'id', 'sku', 'a_number',
      'name_en', 'name_de',
      'description_en',
      'brand', 'supplier_name',
      'colors', 'sizes',
      'price_min', 'price_max', 'currency',
      'main_image_url', 'main_image_thumbnail_url',
      'category', 'total_variants_count'
    ]
  });

  return results;
};
```

### Get Facets (for filter UI)

```typescript
const getFacets = async () => {
  const results = await index.search('', {
    limit: 0,  // We only want facets, not results
    facets: ['colors', 'sizes', 'supplier_name', 'brand', 'category'],
    filter: 'is_active = true'
  });

  return results.facetDistribution;
  // Returns: { colors: { "Blue": 150, "Red": 120, ... }, sizes: { "M": 200, ... }, ... }
};
```

---

## Part 3: Complete Integration Flow

Here's how to wire everything together:

```typescript
import { GoogleGenAI } from '@google/genai';
import { MeiliSearch } from 'meilisearch';

// Initialize clients
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const meilisearch = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST,
  apiKey: process.env.MEILISEARCH_SEARCH_KEY
});
const productIndex = meilisearch.index('pim_products');

const GEMINI_STORE_ID = 'fileSearchStores/promoatlas-product-catalog-xfex8hxfyifx';

/**
 * Main chat function - handles user product queries
 */
async function handleProductChat(userMessage: string) {
  // Step 1: Ask Gemini to find relevant products semantically
  const geminiResponse = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `You are a promotional products expert. Help the user find products.

User query: ${userMessage}

Instructions:
- Search the product catalog for relevant items
- Always mention specific product A-numbers (e.g., A407-2030) when referencing products
- Include price ranges when available
- Suggest alternatives if exact match not found`,
    config: {
      tools: [{
        fileSearch: {
          fileSearchStoreNames: [GEMINI_STORE_ID]
        }
      }]
    }
  });

  const aiText = geminiResponse.text || '';

  // Step 2: Extract product identifiers from AI response
  const aNumbers = extractANumbers(aiText);

  // Step 3: Fetch actual product data from Meilisearch
  let products = [];
  if (aNumbers.length > 0) {
    const meiliResults = await productIndex.search('', {
      filter: `a_number IN [${aNumbers.map(n => `"${n}"`).join(', ')}] AND is_active = true`,
      limit: 20
    });
    products = meiliResults.hits;
  }

  // Step 4: Return both AI response and verified product data
  return {
    aiResponse: aiText,
    products: products,
    productCount: products.length
  };
}

/**
 * Extract A-numbers from text (e.g., A407-2030)
 */
function extractANumbers(text: string): string[] {
  const pattern = /A\d{2,3}-\d{4}/g;
  const matches = text.match(pattern) || [];
  return [...new Set(matches)];
}

// Usage example
const result = await handleProductChat(
  'I need eco-friendly pens for a marketing event, around 500 pieces, budget €2 each'
);

console.log('AI says:', result.aiResponse);
console.log('Found products:', result.products);
```

---

## Part 4: Displaying Products

### React Component Example

```tsx
interface Product {
  id: string;
  sku: string;
  a_number: string;
  name_en?: string;
  description_en?: string;
  price_min?: number;
  price_max?: number;
  currency: string;
  colors: string[];
  sizes: string[];
  main_image_url?: string;
  main_image_thumbnail_url?: string;
  supplier_name: string;
}

function ProductCard({ product }: { product: Product }) {
  const formatPrice = (min?: number, max?: number, currency = 'EUR') => {
    if (!min && !max) return 'Price on request';
    if (min === max) return `€${min?.toFixed(2)}`;
    return `€${min?.toFixed(2)} - €${max?.toFixed(2)}`;
  };

  return (
    <div className="product-card">
      <img
        src={product.main_image_thumbnail_url || product.main_image_url || '/placeholder.png'}
        alt={product.name_en || product.sku}
        loading="lazy"
      />
      <div className="product-info">
        <h3>{product.name_en || product.sku}</h3>
        <p className="sku">{product.a_number}</p>
        <p className="price">{formatPrice(product.price_min, product.price_max)}</p>
        <div className="colors">
          {product.colors.slice(0, 5).map(color => (
            <span key={color} className="color-badge">{color}</span>
          ))}
          {product.colors.length > 5 && <span>+{product.colors.length - 5} more</span>}
        </div>
        <p className="supplier">by {product.supplier_name}</p>
      </div>
    </div>
  );
}
```

### Multilingual Support

```typescript
// Helper to get localized text
function getLocalizedText(
  product: Product,
  field: 'name' | 'description' | 'material',
  preferredLang = 'en'
): string {
  const langOrder = [preferredLang, 'en', 'de', 'fr', 'es'];

  for (const lang of langOrder) {
    const value = product[`${field}_${lang}`];
    if (value) return value;
  }

  return '';
}

// Usage
const productName = getLocalizedText(product, 'name', 'de'); // Try German first
```

---

## Troubleshooting

### Gemini Returns "I don't have access to product information"

**Cause**: Wrong API format or store ID
**Fix**: Ensure you're using `fileSearchStoreNames` (not `fileSearchStoreIds`) and the exact store ID

### Meilisearch Returns Empty Results

**Cause**: Filter syntax error or wrong index name
**Fix**:
- Check index name is `pim_products`
- Verify filter syntax (strings need quotes: `supplier_code = "A407"`)
- Check `is_active = true` filter isn't excluding everything

### Products in Gemini but Not in Meilisearch

**Cause**: Sync lag between systems
**Fix**: This is rare. Contact Neno to trigger a reindex.

### Images Not Loading

**Cause**: R2 bucket access or URL format
**Fix**: Images are served from Cloudflare R2. URLs should work directly. If broken, the product may not have images uploaded.

---

## Quick Reference

| What | Where | Example |
|------|-------|---------|
| Semantic search | Gemini | "eco-friendly bags under €5" |
| Text search | Meilisearch | `index.search('notebook')` |
| Filter by color | Meilisearch | `filter: 'colors = "Blue"'` |
| Filter by price | Meilisearch | `filter: 'price_min >= 2 AND price_max <= 10'` |
| Get single product | Meilisearch | `index.getDocument('product-{id}')` |
| Product images | Direct URL | `product.main_image_url` |

---

## Need Help?

- **API Keys**: Ask Neno or check 1Password
- **Technical Issues**: Check the `backend/scripts/` folder for debugging scripts
- **Architecture Questions**: See `.claude/ARCHITECTURE.md` in the repo

---

*Document created for PromoAtlas PIM integration. Update as APIs evolve.*
