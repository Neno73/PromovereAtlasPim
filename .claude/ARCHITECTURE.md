# Architecture

*Last updated: 2025-10-29 19:40*

System design and component structure for PromoAtlas PIM.

## System Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│  React Frontend │────────▶│  Strapi Backend │────────▶│   PostgreSQL    │
│  (Port 3001)    │  REST   │  (Port 1337)    │  pg     │     (Neon)      │
│                 │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                     │
                                     │
                            ┌────────┴────────┐
                            │                 │
                            ▼                 ▼
                    ┌───────────────┐  ┌──────────────┐
                    │ Cloudflare R2 │  │  Promidata   │
                    │  (Images)     │  │     API      │
                    └───────────────┘  └──────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │   AutoRAG    │
                                       │ (Vector DB)  │
                                       └──────────────┘
```

## Backend Architecture (Strapi 5)

### Directory Structure

```
backend/
├── src/
│   ├── api/                       # Content types & APIs
│   │   ├── product/               # Main product catalog
│   │   │   ├── content-types/
│   │   │   │   └── product/
│   │   │   │       ├── schema.json      (6.2 KB)
│   │   │   │       └── lifecycles.ts    (AutoRAG sync)
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── services/
│   │   ├── supplier/              # 56 Promidata suppliers
│   │   ├── category/              # Product categories
│   │   ├── sync-configuration/    # Sync tracking
│   │   ├── promidata-sync/        # Core sync orchestration
│   │   │   ├── controllers/       (HTTP handlers)
│   │   │   ├── routes/            (API routes)
│   │   │   └── services/
│   │   │       └── promidata-sync.ts  (63 KB - main logic)
│   │   ├── autorag/               # AutoRAG vector DB
│   │   └── supplier-autorag-config/
│   ├── components/                # Reusable content components
│   │   ├── dimensions/            # Product dimensions
│   │   ├── price-tiers/           # 8-tier pricing
│   │   └── imprint-position/      # Customization data
│   ├── services/
│   │   └── autorag.ts             # AutoRAG service
│   ├── index.ts                   # Bootstrap logic
│   └── middlewares/
├── config/
│   ├── database.ts                # PostgreSQL config
│   ├── plugins.ts                 # R2 upload config
│   └── server.ts
├── database/
│   └── migrations/                # Database migrations
├── types/
│   └── generated/                 # Strapi types
└── public/
    └── uploads/                   # Local dev uploads
```

### Content Type Architecture

**Updated 2025-10-29**: Migrated to Product → Product Variant hierarchy

#### Product (Main Product/Family)

**Schema** (`backend/src/api/product/content-types/product/schema.json`):
```json
{
  "kind": "collectionType",
  "collectionName": "products",
  "info": { "singularName": "product", "pluralName": "products" },
  "attributes": {
    "sku": { "type": "string", "required": true, "unique": true },
    "a_number": { "type": "string", "required": true },          // Product family identifier
    "supplier_sku": { "type": "string" },
    "supplier_name": { "type": "string" },
    "brand": { "type": "string" },
    "category": { "type": "string" },
    "total_variants_count": { "type": "integer", "default": 0 },
    "name": { "type": "json" },          // { en: "", de: "", fr: "", es: "" }
    "description": { "type": "json" },   // Multilingual JSON
    "model_name": { "type": "json" },
    "material": { "type": "json" },
    "customization": { "type": "json" },
    "refining": { "type": "json" },
    "price_tiers": {
      "type": "component",
      "repeatable": true,
      "component": "product.price-tier"
    },
    "dimensions": {
      "type": "component",
      "repeatable": false,
      "component": "product.dimensions"
    },
    "imprint_position": {
      "type": "component",
      "repeatable": true,
      "component": "product.imprint-position"
    },
    "main_image": { "type": "media", "multiple": false },
    "gallery_images": { "type": "media", "multiple": true },
    "model_image": { "type": "media", "multiple": false },
    "categories": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::category.category",
      "inversedBy": "products"
    },
    "supplier": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::supplier.supplier",
      "inversedBy": "products"
    },
    "variants": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::product-variant.product-variant",
      "mappedBy": "product"
    },
    "promidata_hash": { "type": "string" },  // SHA-1 for incremental sync
    "last_synced": { "type": "datetime" },
    "is_active": { "type": "boolean", "default": true }
  }
}
```

**Purpose**: Represents main product family (e.g., "Classic T-Shirt"). Stores shared information like pricing, main images, and descriptions.

#### Product Variant (Size/Color Variations)

**Schema** (`backend/src/api/product-variant/content-types/product-variant/schema.json`):
```json
{
  "kind": "collectionType",
  "collectionName": "product_variants",
  "info": { "singularName": "product-variant", "pluralName": "product-variants" },
  "attributes": {
    "sku": { "type": "string", "required": true, "unique": true },
    "name": { "type": "string" },
    "description": { "type": "richtext" },
    "color": { "type": "string" },
    "size": { "type": "string" },
    "sizes": { "type": "json" },                // Available sizes array
    "hex_color": { "type": "string" },
    "supplier_color_code": { "type": "string" },
    "material": { "type": "string" },
    "dimensions_length": { "type": "decimal" },  // Flattened for performance
    "dimensions_width": { "type": "decimal" },
    "dimensions_height": { "type": "decimal" },
    "dimensions_diameter": { "type": "decimal" },
    "weight": { "type": "decimal" },
    "primary_image": { "type": "media", "multiple": false },
    "gallery_images": { "type": "media", "multiple": true },
    "is_primary_for_color": { "type": "boolean", "default": false },
    "is_active": { "type": "boolean", "default": true },
    "product": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::product.product",
      "inversedBy": "variants"
    }
  }
}
```

**Purpose**: Specific size/color combination (e.g., "Classic T-Shirt - Black - Large"). Stores variant-specific data like dimensions, color codes, and variant images.

**Key Pattern**: `is_primary_for_color` flag marks one variant per color for product listings.

**Lifecycle Hooks** (`backend/src/api/product/content-types/product/lifecycles.ts`):
- `afterCreate` → Sync product to AutoRAG
- `afterUpdate` → Update product in AutoRAG
- `afterDelete` → Remove product from AutoRAG
- Triggered only for active suppliers with real-time sync

#### Supplier

**Key Fields**:
- `code` (unique, max 10 chars) - Promidata supplier code (A23, A360, A618)
- `is_active`, `auto_import` - Control flags
- `last_sync_date`, `last_sync_status`, `last_sync_message`
- `products_count`, `last_hash` - Sync metrics

**Bootstrap** (`backend/src/index.ts`):
- Auto-creates 56 suppliers from Promidata on first run
- Updates existing suppliers with new metadata

#### Category

**Structure**:
- `code` (unique) - Category identifier
- `name` (JSON) - Multilingual names
- `sort_order` - Display order
- `parent` (relation) - Self-referential for hierarchy

**Import Source**: `CAT.csv` from Promidata

#### Components

**Price Tier** (`components/price-tiers/price-tier.json`):
```json
{
  "quantity": { "type": "integer" },
  "price": { "type": "decimal" },
  "buying_price": { "type": "decimal" },
  "currency": { "type": "string", "default": "EUR" },
  "price_type": { "type": "enumeration", "enum": ["selling", "buying", "recommended"] },
  "region": { "type": "string" }
}
```

**Dimensions** (`components/dimensions/dimensions.json`):
```json
{
  "length": { "type": "decimal" },
  "width": { "type": "decimal" },
  "height": { "type": "decimal" },
  "diameter": { "type": "decimal" },
  "weight": { "type": "decimal" },
  "unit": { "type": "enumeration", "enum": ["cm", "mm", "m", "in"] },
  "weight_unit": { "type": "enumeration", "enum": ["g", "kg", "oz", "lb"] }
}
```

### Service Layer Architecture

#### Promidata Sync Service (Core Logic)

**Location**: `backend/src/api/promidata-sync/services/promidata-sync.ts` (63 KB)

**Key Methods**:

1. **`fetchSuppliersFromPromidata()`**
   - Parses `Import/Import.txt` for supplier list
   - Returns array of supplier codes (A23, A360, etc.)

2. **`parseProductUrlsWithHashes(supplierCode)`**
   - Extracts product URLs with SHA-1 hashes from Import.txt
   - Format: `URL SHA1_HASH`
   - Returns: `{ url, hash }[]`

3. **`syncSupplier(supplier)`**
   - **Incremental sync logic**:
     ```typescript
     const productUrlsWithHashes = await parseProductUrlsWithHashes(supplier.code);
     let skipped = 0, processed = 0;

     for (const { url, hash } of productUrlsWithHashes) {
       const existing = await strapi.entityService.findMany('api::product.product', {
         filters: { promidata_hash: hash },
         limit: 1
       });

       if (existing.length > 0) {
         skipped++;
         continue; // Skip unchanged product
       }

       const productData = await fetchProductData(url);
       await createOrUpdateProduct(productData, supplier);
       processed++;
     }

     console.log(`Efficiency: ${(skipped / (skipped + processed) * 100).toFixed(1)}% unchanged`);
     ```

4. **`fetchProductData(productUrl)`**
   - Downloads individual product JSON from Promidata
   - Returns raw product data

5. **`createOrUpdateProduct(productData, supplier)`**
   - **Data transformation**:
     - Extract multilingual fields (name, description, color, material)
     - Parse price tiers (8 levels)
     - Parse dimensions (length, width, height, weight)
     - Download and upload images to R2
     - Assign categories from CAT.csv mapping
     - Store `promidata_hash` for incremental sync
   - **Upsert logic**: Find by SKU, create or update

6. **`startSync(supplierId?)`**
   - Orchestrates full sync for one or all active suppliers
   - Updates sync configuration records
   - Logs performance metrics

7. **`importCategories()`**
   - Parses `Import/CAT.csv`
   - Creates category hierarchy with multilingual names

**Promidata API Configuration**:
```typescript
const promidataConfig = {
  baseUrl: 'https://promi-dl.de/Profiles/Live/849c892e-b443-4f49-be3a-61a351cbdd23',
  endpoints: {
    suppliers: '/Import/Import.txt',
    categories: '/Import/CAT.csv',
    products: (code) => `/${code}/${code}-100804.json`
  }
};
```

#### AutoRAG Service

**Location**: `backend/src/services/autorag.ts`

**Purpose**: Real-time sync of products to AutoRAG vector database for AI-powered search

**Key Methods**:
- `syncProduct(product)` - Send product to AutoRAG
- `deleteProduct(productId)` - Remove product from AutoRAG
- `transformProductForAutoRAG(product)` - Convert Strapi product to AutoRAG format

**Integration**: Called from product lifecycle hooks

### API Routes & Controllers

**Pattern**: Controllers are thin HTTP handlers, services contain business logic

**Example Route** (`backend/src/api/promidata-sync/routes/promidata-sync.ts`):
```typescript
export default {
  routes: [
    {
      method: 'POST',
      path: '/promidata-sync/start',
      handler: 'promidata-sync.startSync',
      config: { policies: [] }
    }
  ]
};
```

**Controller** calls service:
```typescript
async startSync(ctx) {
  const { supplierId } = ctx.request.body;
  const result = await strapi.service('api::promidata-sync.promidata-sync').startSync(supplierId);
  ctx.send(result);
}
```

### Database Schema

**Tables** (PostgreSQL via Neon):
- `products` - Main product catalog (1000+ records)
- `suppliers` - 56 Promidata suppliers
- `categories` - Product categories with hierarchy
- `products_categories_links` - Many-to-many join table
- `sync_configurations` - Sync tracking
- `promidata_syncs` - Sync operation logs
- `supplier_autorag_configs` - AutoRAG sync configuration
- `files` - Media library (product images)
- `upload_folders` - Media organization
- `strapi_*` tables - Strapi internal tables

**Key Indexes**:
- `products.sku` (unique)
- `products.promidata_hash` (for incremental sync lookup)
- `suppliers.code` (unique)
- `categories.code` (unique)

## Frontend Architecture (React + TypeScript)

### Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ProductCard.tsx        (170 lines)
│   │   ├── ProductCard.css
│   │   ├── FilterBar.tsx          (150+ lines)
│   │   └── FilterBar.css
│   ├── pages/
│   │   ├── ProductList.tsx        (150+ lines)
│   │   ├── ProductList.css
│   │   ├── ProductDetail.tsx      (80+ lines)
│   │   └── ProductDetail.css
│   ├── services/
│   │   └── api.ts                 (122 lines - Singleton API client)
│   ├── types/
│   │   └── index.ts               (TypeScript interfaces)
│   ├── utils/
│   │   └── i18n.ts                (83 lines - Multilingual utils)
│   ├── App.tsx                    (React Router setup)
│   ├── main.tsx                   (React entry point)
│   └── index.css                  (Global styles)
├── public/
│   └── vite.svg
├── index.html
├── vite.config.ts
└── package.json
```

### Component Architecture

#### ProductCard (Display Component)

**Responsibilities**:
- Display product summary (SKU, model, color, price)
- Smart image fitting (cover vs. contain based on aspect ratio)
- Lazy loading images
- Supplier and category badges
- Link to product detail page

**Key Logic** (Smart Image Fit):
```typescript
const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  const aspectRatio = img.naturalWidth / img.naturalHeight;

  // Use 'contain' for most images to prevent cropping
  // Use 'cover' only for landscape-ish images (1.2-1.8 ratio)
  const strategy = (aspectRatio >= 1.2 && aspectRatio <= 1.8) ? 'cover' : 'contain';
  setImageFit(strategy);
};
```

**Props**:
```typescript
interface ProductCardProps {
  product: Product;  // Full product object
}
```

#### FilterBar (Interactive Component)

**Responsibilities**:
- Search input (SKU, model, article number, brand, name)
- Category dropdown (multi-level hierarchy)
- Supplier dropdown
- Price range inputs (min/max)
- Brand filter (dynamically loaded from products)
- Active status toggle
- Emit filter changes to parent

**State Management**:
```typescript
const [filters, setFilters] = useState<Filters>({
  search: '',
  category: '',
  supplier: '',
  minPrice: undefined,
  maxPrice: undefined,
  brand: '',
  isActive: true
});
```

**Props**:
```typescript
interface FilterBarProps {
  onFilterChange: (filters: Filters) => void;
}
```

#### ProductList (Page Component)

**Responsibilities**:
- Fetch products from API with filters
- Pagination (12 per page default)
- Sorting (updatedAt, createdAt, name, SKU, brand)
- Integrate FilterBar
- Display ProductCard grid
- Handle loading/error states

**Data Flow**:
```typescript
useEffect(() => {
  const fetchProducts = async () => {
    const data = await apiService.getProducts({
      filters,
      sort: sortBy,
      pagination: { page, pageSize }
    });
    setProducts(data.data);
    setPagination(data.meta.pagination);
  };
  fetchProducts();
}, [filters, sortBy, page]);
```

#### ProductDetail (Page Component)

**Responsibilities**:
- Fetch single product by documentId
- Display full product information
- Image gallery with smart fitting
- Price tier table
- Dimensions and specifications
- Supplier information
- Category hierarchy display

**Routing**:
```typescript
// React Router setup in App.tsx
<Route path="/products/:documentId" element={<ProductDetail />} />

// Navigate from ProductCard
<Link to={`/products/${product.documentId}`}>View Details</Link>
```

### Service Layer (API Client)

**Location**: `frontend/src/services/api.ts` (122 lines)

**Pattern**: Singleton class with typed methods

**Key Methods**:

```typescript
class ApiService {
  private baseUrl = import.meta.env.VITE_API_URL || '/api';

  // Generic fetch wrapper with error handling
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    return response.json();
  }

  // Get products with advanced filtering
  async getProducts(options?: {
    filters?: Filters;
    sort?: string;
    pagination?: { page: number; pageSize: number };
  }): Promise<ApiResponse<Product[]>> {
    const params = new URLSearchParams();

    // Apply filters
    if (filters?.search) params.append('filters[name][$containsi]', filters.search);
    if (filters?.category) params.append('filters[categories][id][$eq]', filters.category);
    if (filters?.supplier) params.append('filters[supplier][id][$eq]', filters.supplier);
    if (filters?.minPrice) params.append('filters[price_tiers][price][$gte]', filters.minPrice);
    if (filters?.maxPrice) params.append('filters[price_tiers][price][$lte]', filters.maxPrice);
    if (filters?.brand) params.append('filters[model][$containsi]', filters.brand);
    if (filters?.isActive !== undefined) params.append('filters[is_active][$eq]', filters.isActive);

    // Populate relations
    params.append('populate[supplier][fields]', 'code');
    params.append('populate[categories][fields]', 'name,code');
    params.append('populate[main_image][fields]', 'url');

    // Pagination
    params.append('pagination[page]', options?.pagination?.page || 1);
    params.append('pagination[pageSize]', options?.pagination?.pageSize || 12);

    return this.fetch<ApiResponse<Product[]>>(`/products?${params}`);
  }

  // Get single product by documentId (Strapi 5 pattern)
  async getProduct(documentId: string): Promise<Product> {
    const response = await this.fetch<ApiResponse<Product>>(`/products/${documentId}?populate=*`);
    return response.data;
  }

  // Get categories
  async getCategories(): Promise<ApiResponse<Category[]>> {
    return this.fetch<ApiResponse<Category[]>>('/categories?pagination[pageSize]=100');
  }

  // Get suppliers
  async getSuppliers(): Promise<ApiResponse<Supplier[]>> {
    return this.fetch<ApiResponse<Supplier[]>>('/suppliers?pagination[pageSize]=100');
  }

  // Get unique brands (fetch products and extract unique model values)
  async getBrands(): Promise<string[]> {
    const response = await this.fetch<ApiResponse<Product[]>>('/products?fields[0]=model&pagination[pageSize]=1000');
    const brands = response.data.map(p => p.model).filter(Boolean);
    return Array.from(new Set(brands)).sort();
  }
}

export const apiService = new ApiService();
```

**Strapi 5 Compatibility**:
- Uses `documentId` for routing (not numeric IDs)
- No `.attributes` wrapper in responses
- Deep populate syntax: `populate[relation][fields]=field1,field2`

### Utility Functions

**Location**: `frontend/src/utils/i18n.ts` (83 lines)

**Key Functions**:

```typescript
// Extract localized text with fallback chain
export function getLocalizedText(
  multilingualText: MultilingualText | string | undefined,
  preferredLanguage: string = 'en'
): string {
  if (!multilingualText) return '';
  if (typeof multilingualText === 'string') return multilingualText;

  // Try preferred language → fallback chain → first available
  return multilingualText[preferredLanguage] ||
         multilingualText.en ||
         multilingualText.de ||
         multilingualText.fr ||
         multilingualText.es ||
         Object.values(multilingualText)[0] ||
         '';
}

// Format price with currency
export function formatPrice(price: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(price);
}

// Parse dimension components
export function formatDimensions(dimensions: Dimensions): string {
  const parts = [];
  if (dimensions.length) parts.push(`L: ${dimensions.length}${dimensions.unit}`);
  if (dimensions.width) parts.push(`W: ${dimensions.width}${dimensions.unit}`);
  if (dimensions.height) parts.push(`H: ${dimensions.height}${dimensions.unit}`);
  return parts.join(', ');
}

// Format weight with unit
export function formatWeight(weight: number, unit: string = 'g'): string {
  return `${weight}${unit}`;
}
```

### TypeScript Types

**Location**: `frontend/src/types/index.ts`

**Key Interfaces**:

```typescript
export interface MultilingualText {
  en?: string;
  de?: string;
  fr?: string;
  es?: string;
}

export interface Product {
  documentId: string;
  sku: string;
  model?: string;
  article_number?: string;
  name: MultilingualText;
  description?: MultilingualText;
  color_name?: MultilingualText;
  color_code?: string;
  material?: MultilingualText;
  price_tiers: PriceTier[];
  dimensions?: Dimensions;
  main_image?: Media;
  gallery_images?: Media[];
  model_image?: Media;
  categories: Category[];
  supplier: Supplier;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}
```

## Data Flow

### Product Sync Flow

```
1. Admin triggers sync (manual) or cron job (automatic)
2. Promidata Sync Service fetches Import.txt
3. Parse product URLs with SHA-1 hashes
4. For each product:
   a. Check if hash exists in database
   b. If exists, skip (unchanged)
   c. If new/changed:
      - Download product JSON
      - Transform data (multilingual fields, price tiers)
      - Download images
      - Upload to R2
      - Create/update product in Strapi
      - Store promidata_hash
5. Log sync metrics (skipped/processed/efficiency)
6. Trigger AutoRAG sync (lifecycle hooks)
```

### Product Display Flow (Frontend)

```
1. User visits ProductList page
2. FilterBar component mounts, fetches categories/suppliers
3. User applies filters → onFilterChange callback
4. ProductList calls apiService.getProducts(filters)
5. API request to Strapi: /api/products?filters=...&populate=...
6. Strapi returns paginated products with populated relations
7. ProductList renders ProductCard grid
8. User clicks product → Navigate to ProductDetail
9. ProductDetail fetches single product: /api/products/:documentId?populate=*
10. Display full product information
```

## Security & Permissions

### Backend (Strapi)

**Bootstrap Permissions** (`backend/src/index.ts`):
- Auto-enables public access for:
  - `api::product.product.find`
  - `api::product.product.findOne`
  - `api::category.category.find`
  - `api::category.category.findOne`
  - `api::supplier.supplier.find`
  - `api::supplier.supplier.findOne`

**Admin-Only Endpoints**:
- All write operations (create, update, delete)
- Sync operations (`/promidata-sync/start`)
- AutoRAG configuration

**Authentication**:
- JWT-based admin authentication
- API token for external access (not used by frontend)

### Frontend

**No Authentication**:
- Public product catalog (read-only)
- No user accounts needed
- No sensitive data exposed

## Performance Considerations

### Backend Optimizations

1. **Incremental Sync**: Hash-based sync prevents duplicate processing (89% efficiency)
2. **Database Indexing**: SKU, promidata_hash, supplier_code indexed
3. **Connection Pooling**: Neon with Hyperdrive (2-10 connections)
4. **Image CDN**: Cloudflare R2 serves images globally

### Frontend Optimizations

1. **Lazy Loading**: Images loaded on-demand
2. **Pagination**: 12 products per page (not loading all 1000+)
3. **Smart Image Fit**: Prevents layout shift with aspect ratio detection
4. **Singleton API Client**: Reuses fetch wrapper, prevents duplicate code
5. **Vite Proxy**: `/api/*` → backend (no CORS issues in dev)

### Future Optimizations

1. **Backend**:
   - Add Redis cache for frequently accessed products
   - Implement GraphQL for flexible queries
   - Add database query optimization (EXPLAIN ANALYZE)
   - Batch R2 uploads for faster sync

2. **Frontend**:
   - Add virtual scrolling for long product lists
   - Implement image lazy loading library (react-lazy-load-image)
   - Add service worker for offline support
   - Optimize bundle size (code splitting)

---

*Update this document when making architectural changes or adding new features.*
