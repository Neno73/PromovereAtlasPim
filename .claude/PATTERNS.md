# Code Patterns

*Last updated: 2025-10-29 19:40*

Code conventions and patterns used in PromoAtlas PIM. **These are the ACTUAL patterns found in this codebase**, not generic best practices.

## File Naming Conventions

### Backend (Strapi)
- **Content type folders**: `kebab-case` (e.g., `promidata-sync/`, `sync-configuration/`)
- **JavaScript/TypeScript files**: `camelCase.ts` or `kebab-case.ts` (e.g., `promidata-sync.ts`, `autorag.ts`)
- **Schema files**: `schema.json` (Strapi convention)
- **Lifecycle files**: `lifecycles.ts`

### Frontend (React)
- **React components**: `PascalCase.tsx` (e.g., `ProductCard.tsx`, `FilterBar.tsx`)
- **Pages**: `PascalCase.tsx` (e.g., `ProductList.tsx`, `ProductDetail.tsx`)
- **Utilities**: `camelCase.ts` (e.g., `api.ts`, `i18n.ts`)
- **Types**: `index.ts` (barrel exports)
- **CSS Modules**: Match component name (e.g., `ProductCard.css`, `FilterBar.css`)

### General
- **Config files**: `kebab-case` or `camelCase` (e.g., `vite.config.ts`, `tsconfig.json`)
- **Documentation**: `UPPERCASE.md` (e.g., `README.md`, `CLAUDE.md`)

## TypeScript Patterns

### Backend Service Pattern (Strapi Factory)

```typescript
// Pattern: Strapi service using factories.createCoreService
export default factories.createCoreService('api::type.type', ({ strapi }) => ({
  // Custom service methods
  async customMethod(param1, param2) {
    try {
      // Business logic here
      const result = await strapi.entityService.findMany('api::type.type', {
        filters: { field: param1 },
        populate: ['relation']
      });

      return { success: true, data: result };
    } catch (error) {
      strapi.log.error(`Error in customMethod: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}));
```

**Key characteristics**:
- Use `factories.createCoreService()` from `@strapi/strapi`
- Destructure `{ strapi }` from factory parameter
- Return objects with `{ success, data?, error? }` structure
- Use `strapi.log.info()` and `strapi.log.error()` for logging
- Use `strapi.entityService` for database operations

### Frontend Component Pattern (Functional Components)

```typescript
// Pattern: Functional component with TypeScript
import React, { FC, useState, useEffect } from 'react';
import './ComponentName.css';

interface ComponentNameProps {
  prop1: string;
  prop2?: number; // Optional props with ?
}

export const ComponentName: FC<ComponentNameProps> = ({ prop1, prop2 }) => {
  const [state, setState] = useState<Type>(initialValue);

  useEffect(() => {
    // Side effects
  }, [dependencies]);

  const handleEvent = () => {
    // Event handler logic
  };

  return (
    <div className="component-name">
      {/* JSX */}
    </div>
  );
};
```

**Key characteristics**:
- Use `FC<Props>` type from React
- Define props interface with explicit types
- Use hooks (`useState`, `useEffect`) for state management
- Export as named export (not default)
- CSS class names match component name in kebab-case

### API Client Pattern (Singleton Service)

```typescript
// Pattern: Singleton API client
class ApiService {
  private baseUrl = import.meta.env.VITE_API_URL || '/api';

  // Generic typed fetch wrapper
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    return response.json();
  }

  // Public methods
  async getResource<T>(resourceId: string): Promise<T> {
    return this.fetch<T>(`/resources/${resourceId}`);
  }
}

// Singleton export
export const apiService = new ApiService();
```

**Key characteristics**:
- Private `fetch<T>()` method for type safety
- Generic type parameters for flexibility
- Singleton instance exported
- Environment variables via `import.meta.env.VITE_*`

## Service Layer Patterns

### Backend Service Structure

```typescript
// Pattern: Service method with error handling
async methodName(param1: string, param2?: object) {
  try {
    // 1. Validate inputs
    if (!param1) {
      throw new Error('param1 is required');
    }

    // 2. Fetch data using entityService
    const data = await strapi.entityService.findMany('api::type.type', {
      filters: { field: param1 },
      populate: {
        relation: {
          fields: ['field1', 'field2']
        }
      }
    });

    // 3. Business logic transformation
    const transformed = data.map(item => this.transformItem(item));

    // 4. Log success
    strapi.log.info(`Successfully processed ${transformed.length} items`);

    // 5. Return structured response
    return {
      success: true,
      data: transformed,
      count: transformed.length
    };
  } catch (error) {
    // 6. Log and return error
    strapi.log.error(`Error in methodName: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

**Key characteristics**:
- Input validation first
- Use `strapi.entityService` for database operations
- Transform data in service layer (not controller)
- Structured return: `{ success, data?, error? }`
- Always log errors with context

### Frontend Service Pattern

```typescript
// Pattern: API client method
async getProducts(options?: {
  filters?: Filters;
  sort?: string;
  pagination?: { page: number; pageSize: number };
}): Promise<ApiResponse<Product[]>> {
  // 1. Build query parameters
  const params = new URLSearchParams();

  // 2. Apply filters conditionally
  if (options?.filters?.search) {
    params.append('filters[name][$containsi]', options.filters.search);
  }

  // 3. Populate relations (Strapi 5 deep populate syntax)
  params.append('populate[supplier][fields]', 'code');
  params.append('populate[categories][fields]', 'name,code');

  // 4. Pagination
  params.append('pagination[page]', String(options?.pagination?.page || 1));
  params.append('pagination[pageSize]', String(options?.pagination?.pageSize || 12));

  // 5. Fetch with typed response
  return this.fetch<ApiResponse<Product[]>>(`/products?${params}`);
}
```

**Key characteristics**:
- Optional parameters with default values
- Use `URLSearchParams` for query building
- Strapi 5 deep populate syntax: `populate[relation][fields]=field1,field2`
- Return typed `ApiResponse<T>`
- No error handling (let caller handle)

## Database Operations

### Strapi Entity Service Pattern

```typescript
// Pattern: Find with filters and populate
const products = await strapi.entityService.findMany('api::product.product', {
  filters: {
    sku: { $eq: 'SKU123' },
    is_active: true,
    categories: {
      code: { $in: ['CAT1', 'CAT2'] }
    }
  },
  populate: {
    supplier: {
      fields: ['code', 'name']
    },
    categories: true,
    main_image: true
  },
  sort: 'createdAt:desc',
  limit: 100,
  offset: 0
});
```

**Key characteristics**:
- Use `strapi.entityService.findMany()` for queries
- Filters use Strapi query operators: `$eq`, `$in`, `$containsi`, `$gte`, `$lte`
- Populate can be boolean (all fields) or object (specific fields)
- Sort syntax: `fieldName:asc` or `fieldName:desc`

### Upsert Pattern (Find or Create)

```typescript
// Pattern: Find by unique field, create if not exists, update if exists
const existingProduct = await strapi.entityService.findMany('api::product.product', {
  filters: { sku: productData.sku },
  limit: 1
});

if (existingProduct.length > 0) {
  // Update existing
  await strapi.entityService.update('api::product.product', existingProduct[0].id, {
    data: {
      name: productData.name,
      price_tiers: productData.price_tiers,
      promidata_hash: productData.hash,
      last_synced: new Date()
    }
  });
} else {
  // Create new
  await strapi.entityService.create('api::product.product', {
    data: {
      sku: productData.sku,
      name: productData.name,
      price_tiers: productData.price_tiers,
      promidata_hash: productData.hash,
      supplier: supplierId,
      is_active: true
    }
  });
}
```

**Key characteristics**:
- Find by unique field (e.g., SKU) with `limit: 1`
- Check array length to determine if exists
- Use `entityService.update()` or `entityService.create()`
- Wrap data in `{ data: { ... } }` object

## Component Patterns

### Smart Image Fitting Pattern

```typescript
// Pattern: Adaptive image object-fit based on aspect ratio
const [imageFit, setImageFit] = useState<'cover' | 'contain'>('contain');

const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  const aspectRatio = img.naturalWidth / img.naturalHeight;

  // Use 'contain' for most images to prevent cropping
  // Use 'cover' only for landscape-ish images (1.2-1.8 ratio)
  const strategy = (aspectRatio >= 1.2 && aspectRatio <= 1.8) ? 'cover' : 'contain';
  setImageFit(strategy);
};

return (
  <img
    src={imageUrl}
    onLoad={handleImageLoad}
    style={{ objectFit: imageFit }}
    alt="Product"
  />
);
```

**Key characteristics**:
- Calculate aspect ratio from `naturalWidth` / `naturalHeight`
- Default to `'contain'` to prevent cropping
- Use `'cover'` only for specific aspect ratio range
- Set strategy in `onLoad` handler

### Filter State Management Pattern

```typescript
// Pattern: Filter state with clean-up and callback
const [filters, setFilters] = useState<Filters>({
  search: '',
  category: '',
  supplier: '',
  minPrice: undefined,
  maxPrice: undefined,
  isActive: true
});

const handleFilterChange = (key: keyof Filters, value: any) => {
  const newFilters = { ...filters, [key]: value };

  // Clean up empty values
  const cleanedFilters = Object.entries(newFilters)
    .filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Filters);

  setFilters(cleanedFilters);
  onFilterChange(cleanedFilters); // Notify parent
};
```

**Key characteristics**:
- Use object state for multiple filters
- Clean up empty values before applying
- Lift state up via callback prop
- Use generic `keyof Filters` for type safety

### Pagination Pattern

```typescript
// Pattern: Pagination with API integration
const [page, setPage] = useState(1);
const [pageSize] = useState(12);
const [pagination, setPagination] = useState({
  page: 1,
  pageSize: 12,
  pageCount: 0,
  total: 0
});

useEffect(() => {
  const fetchData = async () => {
    const response = await apiService.getProducts({
      filters,
      pagination: { page, pageSize }
    });

    setProducts(response.data);
    setPagination(response.meta.pagination);
  };

  fetchData();
}, [page, filters]);

const handleNextPage = () => {
  if (page < pagination.pageCount) {
    setPage(page + 1);
  }
};
```

**Key characteristics**:
- Track current page and page size in state
- Store pagination metadata from API response
- Re-fetch when page or filters change
- Use `meta.pagination` from Strapi API response

## Multilingual Data Patterns

### Storing Multilingual Data (Backend)

```typescript
// Pattern: Store multilingual fields as JSON
const productData = {
  sku: 'SKU123',
  name: {
    en: 'Product Name',
    de: 'Produktname',
    fr: 'Nom du produit',
    es: 'Nombre del producto'
  },
  description: {
    en: 'Description in English',
    de: 'Beschreibung auf Deutsch',
    // ... other languages
  }
};

await strapi.entityService.create('api::product.product', {
  data: productData
});
```

**Key characteristics**:
- JSON fields in schema: `"type": "json"`
- Object structure: `{ en: string, de: string, fr: string, es: string }`
- No additional tables or relations needed

### Displaying Multilingual Data (Frontend)

```typescript
// Pattern: Extract localized text with fallback chain
export function getLocalizedText(
  multilingualText: MultilingualText | string | undefined,
  preferredLanguage: string = 'en'
): string {
  if (!multilingualText) return '';
  if (typeof multilingualText === 'string') return multilingualText;

  // Fallback chain: preferred → en → de → fr → es → first available
  return multilingualText[preferredLanguage] ||
         multilingualText.en ||
         multilingualText.de ||
         multilingualText.fr ||
         multilingualText.es ||
         Object.values(multilingualText)[0] ||
         '';
}

// Usage in component
const productName = getLocalizedText(product.name, 'en');
```

**Key characteristics**:
- Helper function for consistent fallback logic
- Handle both string and object types
- Fallback chain prevents missing translations
- Always return string (never undefined)

## CSS Patterns

### CSS Modules Pattern

```css
/* ProductCard.css */
.product-card {
  display: flex;
  flex-direction: column;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
}

.product-card__image {
  width: 100%;
  height: 200px;
  object-fit: contain;
}

.product-card__title {
  font-size: 1.2rem;
  font-weight: bold;
  margin: 0.5rem 0;
}
```

```typescript
// ProductCard.tsx
import './ProductCard.css';

export const ProductCard: FC<Props> = ({ product }) => {
  return (
    <div className="product-card">
      <img className="product-card__image" src={product.image} />
      <h3 className="product-card__title">{product.name}</h3>
    </div>
  );
};
```

**Key characteristics**:
- BEM-like naming: `.block`, `.block__element`, `.block--modifier`
- No CSS-in-JS (no styled-components)
- CSS Modules imported as side effect
- Class names match kebab-case version of component name

### Responsive Design Pattern

```css
/* Mobile-first approach */
.container {
  padding: 1rem;
}

.product-grid {
  display: grid;
  grid-template-columns: 1fr; /* Mobile: 1 column */
  gap: 1rem;
}

/* Tablet: 2 columns */
@media (min-width: 768px) {
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop: 4 columns */
@media (min-width: 1024px) {
  .product-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

**Key characteristics**:
- Mobile-first (base styles for mobile)
- Use `min-width` media queries for larger screens
- CSS Grid for layout
- Standard breakpoints: 768px (tablet), 1024px (desktop)

## Lifecycle Hooks Pattern

### Product Lifecycle (Backend)

```typescript
// Pattern: Strapi lifecycle hooks
// backend/src/api/product/content-types/product/lifecycles.ts

export default {
  async afterCreate(event) {
    const { result } = event;

    // Trigger AutoRAG sync for active suppliers
    const supplier = await strapi.entityService.findOne(
      'api::supplier.supplier',
      result.supplier.id
    );

    if (supplier?.is_active) {
      await strapi.service('autorag').syncProduct(result);
    }
  },

  async afterUpdate(event) {
    const { result } = event;
    // Update AutoRAG
    await strapi.service('autorag').syncProduct(result);
  },

  async afterDelete(event) {
    const { result } = event;
    // Remove from AutoRAG
    await strapi.service('autorag').deleteProduct(result.documentId);
  }
};
```

**Key characteristics**:
- Export default object with lifecycle methods
- Available hooks: `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`
- Access data via `event.result` (after) or `event.params.data` (before)
- Use for side effects (sync to external services, logging, validation)

## Error Handling Patterns

### Backend Error Handling

```typescript
// Pattern: Try-catch with structured error responses
try {
  // Operation
  const result = await riskyOperation();

  strapi.log.info('Operation successful');
  return { success: true, data: result };
} catch (error) {
  strapi.log.error(`Operation failed: ${error.message}`, {
    stack: error.stack,
    context: { operation: 'riskyOperation' }
  });

  return {
    success: false,
    error: error.message || 'Unknown error'
  };
}
```

**Key characteristics**:
- Always wrap risky operations in try-catch
- Log errors with `strapi.log.error()`
- Return structured `{ success, error }` object
- Include context in logs (operation name, parameters)

### Frontend Error Handling

```typescript
// Pattern: Error state in components
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiService.getProducts();
      setProducts(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);

// Render error state
if (error) {
  return <div className="error-message">{error}</div>;
}
```

**Key characteristics**:
- Track error state separately from loading state
- Clear error on retry
- Use `finally` to ensure loading state is cleared
- Display user-friendly error messages

## Import/Export Patterns

### Backend Imports

```typescript
// Pattern: Strapi imports
import { factories } from '@strapi/strapi';
import type { Schema, Attribute } from '@strapi/strapi';

// Service imports
const autoragService = strapi.service('autorag');
const promidataService = strapi.service('api::promidata-sync.promidata-sync');

// Entity service usage
await strapi.entityService.findMany('api::product.product', options);
```

### Frontend Imports

```typescript
// Pattern: React imports
import React, { FC, useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

// Component imports (named exports)
import { ProductCard } from './components/ProductCard';
import { FilterBar } from './components/FilterBar';

// Service imports (singleton)
import { apiService } from './services/api';

// Type imports
import type { Product, Category, Supplier } from './types';

// Utility imports
import { getLocalizedText, formatPrice } from './utils/i18n';

// CSS imports (side effect)
import './ProductList.css';
```

**Key characteristics**:
- Group imports by source (React, third-party, local)
- Use named exports for components
- Import types separately with `type` keyword
- CSS imports at the end

## Anti-Patterns (DO NOT DO)

### Backend Anti-Patterns

❌ **Using default exports for services**
```typescript
// DON'T
export default class MyService { ... }

// DO
export default factories.createCoreService('api::type.type', ({ strapi }) => ({ ... }));
```

❌ **Direct database queries without entityService**
```typescript
// DON'T (bypasses Strapi lifecycle hooks)
await strapi.db.query('api::product.product').findMany();

// DO
await strapi.entityService.findMany('api::product.product');
```

❌ **Ignoring errors silently**
```typescript
// DON'T
try {
  await riskyOperation();
} catch (error) {
  // Silent failure
}

// DO
try {
  await riskyOperation();
} catch (error) {
  strapi.log.error('Operation failed', error);
  return { success: false, error: error.message };
}
```

### Frontend Anti-Patterns

❌ **Using `.attributes` wrapper (Strapi 4 pattern)**
```typescript
// DON'T (Strapi 4)
const productName = response.data.attributes.name;

// DO (Strapi 5)
const productName = response.data.name;
```

❌ **Numeric IDs for routing (Strapi 4 pattern)**
```typescript
// DON'T (Strapi 4)
<Link to={`/products/${product.id}`}>

// DO (Strapi 5)
<Link to={`/products/${product.documentId}`}>
```

❌ **Forgetting to clean up filters**
```typescript
// DON'T (sends empty strings to API)
onFilterChange({ search: '', category: '', supplier: '' });

// DO (remove empty values)
const cleanedFilters = Object.entries(filters)
  .filter(([_, v]) => v !== '' && v !== null)
  .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
```

---

*Update this document when establishing new patterns or conventions in the codebase.*
