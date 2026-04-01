# Code Patterns

*Last updated: 2026-01-03*

Patterns used in this codebase. Match these conventions.

## Naming Conventions

| Location | Convention | Example |
|----------|------------|---------|
| Backend folders | `kebab-case` | `promidata-sync/` |
| Backend files | `kebab-case.ts` | `promidata-sync.ts` |
| React components | `PascalCase.tsx` | `ProductCard.tsx` |
| CSS files | Match component | `ProductCard.css` |
| Types | `index.ts` barrel | `types/index.ts` |

## Backend Patterns

### Strapi Service

```typescript
export default factories.createCoreService('api::type.type', ({ strapi }) => ({
  async customMethod(param1) {
    try {
      const data = await strapi.entityService.findMany('api::type.type', {
        filters: { field: param1 },
        populate: { relation: { fields: ['field1'] } }
      });
      return { success: true, data };
    } catch (error) {
      strapi.log.error(`Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}));
```

**Key points**:
- Use `factories.createCoreService()` from `@strapi/strapi`
- Return `{ success, data?, error? }` structure
- Always use `strapi.entityService` (not `strapi.db.query`)

### Entity Service Queries

```typescript
// Find with filters
await strapi.entityService.findMany('api::product.product', {
  filters: { sku: { $eq: 'SKU123' }, is_active: true },
  populate: { supplier: { fields: ['code'] }, categories: true },
  sort: 'createdAt:desc',
  limit: 100
});

// Upsert pattern
const existing = await strapi.entityService.findMany('api::product.product', {
  filters: { sku }, limit: 1
});
if (existing.length > 0) {
  await strapi.entityService.update('api::product.product', existing[0].id, { data });
} else {
  await strapi.entityService.create('api::product.product', { data });
}
```

**Filter operators**: `$eq`, `$in`, `$containsi`, `$gte`, `$lte`

### Lifecycle Hooks

```typescript
// backend/src/api/product/content-types/product/lifecycles.ts
export default {
  async afterCreate(event) {
    const { result } = event;
    await strapi.service('autorag').syncProduct(result);
  },
  async afterUpdate(event) { /* ... */ },
  async afterDelete(event) { /* ... */ }
};
```

## Frontend Patterns

### React Component

```typescript
import { FC, useState, useEffect } from 'react';
import './ComponentName.css';

interface Props { prop1: string; prop2?: number; }

export const ComponentName: FC<Props> = ({ prop1, prop2 }) => {
  const [state, setState] = useState<Type>(initial);
  useEffect(() => { /* fetch */ }, [deps]);
  return <div className="component-name">{/* JSX */}</div>;
};
```

### API Client

```typescript
class ApiService {
  private baseUrl = import.meta.env.VITE_API_URL || '/api';

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`);
    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    return response.json();
  }

  async getProducts(options?: { filters?: Filters; pagination?: Pagination }) {
    const params = new URLSearchParams();
    if (options?.filters?.search) params.append('filters[name][$containsi]', options.filters.search);
    params.append('populate[supplier][fields]', 'code');
    params.append('pagination[page]', String(options?.pagination?.page || 1));
    return this.fetch<ApiResponse<Product[]>>(`/products?${params}`);
  }
}
export const apiService = new ApiService();
```

### Multilingual Text

```typescript
export function getLocalizedText(text: MultilingualText | string | undefined, lang = 'en'): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.en || text.de || text.fr || Object.values(text)[0] || '';
}
```

### Filter State

```typescript
const [filters, setFilters] = useState<Filters>({ search: '', category: '' });

const handleFilterChange = (key: keyof Filters, value: any) => {
  const newFilters = { ...filters, [key]: value };
  // Clean empty values
  const cleaned = Object.fromEntries(
    Object.entries(newFilters).filter(([_, v]) => v !== '' && v != null)
  );
  setFilters(cleaned);
  onFilterChange(cleaned);
};
```

## CSS Patterns

```css
/* BEM naming, mobile-first */
.product-card { display: flex; flex-direction: column; }
.product-card__image { width: 100%; height: 200px; object-fit: contain; }
.product-card__title { font-size: 1.2rem; }

/* Responsive grid */
.product-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
@media (min-width: 768px) { .product-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .product-grid { grid-template-columns: repeat(4, 1fr); } }
```

## Anti-Patterns (Avoid)

| Don't | Do |
|-------|-----|
| `strapi.db.query()` | `strapi.entityService.findMany()` |
| `response.data.attributes.name` (Strapi 4) | `response.data.name` (Strapi 5) |
| `product.id` for routing | `product.documentId` |
| Silent `catch {}` | Log and return error |
| Empty filter strings to API | Clean filters before sending |

## Import Order

```typescript
// 1. React/external
import React, { FC, useState } from 'react';
import { Link } from 'react-router-dom';

// 2. Local components/services
import { ProductCard } from './components/ProductCard';
import { apiService } from './services/api';

// 3. Types (with 'type' keyword)
import type { Product } from './types';

// 4. CSS (last)
import './ProductList.css';
```

---

*Match existing patterns. Don't introduce new conventions without discussion.*
