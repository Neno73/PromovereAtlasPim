# Testing Strategy for Promidata Sync Services

**Status:** Testing infrastructure not yet implemented
**Framework:** Jest + Supertest (Strapi 5 recommended)
**Last Updated:** 2025-10-29

## Overview

This document outlines the testing strategy for the refactored Promidata sync services. The modularization makes each layer independently testable with appropriate mocking.

## Setup Required

### 1. Install Dependencies

```bash
npm install jest supertest @types/jest @types/supertest --save-dev
```

### 2. Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "jest --forceExit --detectOpenHandles",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:e2e": "jest --testPathPattern=tests/e2e",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### 3. Configure Jest (package.json)

```json
{
  "jest": {
    "testTimeout": 30000,
    "testPathIgnorePatterns": ["/node_modules/", ".cache", "build", "dist"],
    "testMatch": ["**/tests/**/*.test.ts", "**/tests/**/*.test.js"],
    "moduleNameMapper": {
      "^@services/(.*)$": "<rootDir>/src/services/$1",
      "^@api/(.*)$": "<rootDir>/src/api/$1"
    }
  }
}
```

### 4. Test Database Configuration

Create `config/env/test/database.js`:

```javascript
module.exports = {
  connection: {
    client: 'better-sqlite3',
    connection: {
      filename: './.tmp/test.db'
    },
    useNullAsDefault: true,
  },
};
```

## Testing Layers

### Layer 1: Unit Tests (Pure Logic - No Strapi)

**What:** Services with pure business logic, no external dependencies
**Mocking:** None or minimal (only external APIs)
**Speed:** Very fast (< 100ms per test)

#### Parsers (`tests/unit/parsers/`)

**import-parser.test.ts**
```typescript
import importParser from '@services/promidata/parsers/import-parser';
import promidataClient from '@services/promidata/api/promidata-client';

jest.mock('@services/promidata/api/promidata-client');

describe('ImportParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseImportFile', () => {
    it('should parse Import.txt and extract URLs with hashes', async () => {
      const mockImportText = `
https://example.com/A23/A23-100804.json|ABC123
https://example.com/A23/A23-100805.json|DEF456
/Import/CAT.csv|SKIP
      `.trim();

      (promidataClient.fetchText as jest.Mock).mockResolvedValue(mockImportText);

      const result = await importParser.parseImportFile();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        url: 'https://example.com/A23/A23-100804.json',
        hash: 'ABC123',
        sku: 'A23-100804',
        supplierCode: 'A23'
      });
    });

    it('should skip CAT.csv entries', async () => {
      const mockImportText = '/Import/CAT.csv|HASH123';
      (promidataClient.fetchText as jest.Mock).mockResolvedValue(mockImportText);

      const result = await importParser.parseImportFile();
      expect(result).toHaveLength(0);
    });

    it('should handle malformed lines gracefully', async () => {
      const mockImportText = `
invalid-line-without-pipe
https://valid.com/file.json|HASH
      `.trim();

      (promidataClient.fetchText as jest.Mock).mockResolvedValue(mockImportText);

      const result = await importParser.parseImportFile();
      expect(result).toHaveLength(1);
    });
  });

  describe('parseForSupplier', () => {
    it('should filter entries by supplier code', async () => {
      const mockEntries = [
        { url: 'https://example.com/A23/file1.json', hash: 'H1', sku: 'A23-001', supplierCode: 'A23' },
        { url: 'https://example.com/A113/file2.json', hash: 'H2', sku: 'A113-001', supplierCode: 'A113' },
        { url: 'https://example.com/A23/file3.json', hash: 'H3', sku: 'A23-002', supplierCode: 'A23' }
      ];

      jest.spyOn(importParser as any, 'parseImportFile').mockResolvedValue(mockEntries);

      const result = await importParser.parseForSupplier('A23');

      expect(result).toHaveLength(2);
      expect(result.every(e => e.supplierCode === 'A23')).toBe(true);
    });
  });
});
```

**product-parser.test.ts**
```typescript
import productParser from '@services/promidata/parsers/product-parser';

describe('ProductParser', () => {
  describe('normalizeProductData', () => {
    it('should return valid product data as-is', () => {
      const validData = { SKU: 'A23-001', Name: 'Product' };
      const result = (productParser as any).normalizeProductData(validData);
      expect(result).toEqual(validData);
    });

    it('should extract first item from array response', () => {
      const arrayData = [{ SKU: 'A23-001' }, { SKU: 'A23-002' }];
      const result = (productParser as any).normalizeProductData(arrayData);
      expect(result).toEqual({ SKU: 'A23-001' });
    });

    it('should unwrap nested data.product structure', () => {
      const wrappedData = { data: { product: { SKU: 'A23-001' } } };
      const result = (productParser as any).normalizeProductData(wrappedData);
      expect(result).toEqual({ SKU: 'A23-001' });
    });
  });

  describe('parseMultilingualField', () => {
    it('should handle object with language keys', () => {
      const field = { en: 'English', nl: 'Nederlands', de: 'Deutsch' };
      const result = productParser.parseMultilingualField(field);
      expect(result).toEqual(field);
    });

    it('should convert string to all languages', () => {
      const field = 'Universal Text';
      const result = productParser.parseMultilingualField(field);
      expect(result).toEqual({
        en: 'Universal Text',
        nl: 'Universal Text',
        de: 'Universal Text',
        fr: 'Universal Text'
      });
    });

    it('should return null for empty/null input', () => {
      expect(productParser.parseMultilingualField(null)).toBeNull();
      expect(productParser.parseMultilingualField(undefined)).toBeNull();
    });
  });
});
```

#### Transformers (`tests/unit/transformers/`)

**grouping.test.ts**
```typescript
import groupingService from '@services/promidata/transformers/grouping';

describe('GroupingService', () => {
  describe('groupByANumber', () => {
    it('should group variants by a_number field', () => {
      const variants = [
        { a_number: 'A23-100', SKU: 'A23-100-RED-S' },
        { a_number: 'A23-100', SKU: 'A23-100-RED-M' },
        { a_number: 'A23-101', SKU: 'A23-101-BLUE-S' }
      ];

      const result = groupingService.groupByANumber(variants);

      expect(result.size).toBe(2);
      expect(result.get('A23-100')).toHaveLength(2);
      expect(result.get('A23-101')).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const result = groupingService.groupByANumber([]);
      expect(result.size).toBe(0);
    });

    it('should handle missing a_number gracefully', () => {
      const variants = [{ SKU: 'NO-ANUMBER' }];
      const result = groupingService.groupByANumber(variants);
      // Should use fallback grouping logic
    });
  });

  describe('groupByColor', () => {
    it('should group variants by color', () => {
      const variants = [
        { color: 'Red', SKU: 'SKU1' },
        { color: 'Red', SKU: 'SKU2' },
        { color: 'Blue', SKU: 'SKU3' }
      ];

      const result = groupingService.groupByColor(variants);

      expect(result.size).toBe(2);
      expect(result.get('Red')?.variants).toHaveLength(2);
      expect(result.get('Blue')?.variants).toHaveLength(1);
    });

    it('should identify primary variant (first of each color)', () => {
      const variants = [
        { color: 'Red', SKU: 'RED-1' },
        { color: 'Red', SKU: 'RED-2' }
      ];

      const result = groupingService.groupByColor(variants);
      const redGroup = result.get('Red');

      expect(redGroup?.primaryVariant.SKU).toBe('RED-1');
    });
  });
});
```

**hash-service.test.ts**
```typescript
import hashService from '@services/promidata/sync/hash-service';

describe('HashService', () => {
  describe('calculateProductHash', () => {
    it('should generate consistent hash for same data', () => {
      const productData = {
        a_number: 'A23-100',
        name: { en: 'Test Product' },
        description: { en: 'Description' }
      };

      const hash1 = hashService.calculateProductHash(productData);
      const hash2 = hashService.calculateProductHash(productData);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(32); // MD5 length
    });

    it('should generate different hash for different data', () => {
      const data1 = { a_number: 'A23-100', name: { en: 'Product 1' } };
      const data2 = { a_number: 'A23-100', name: { en: 'Product 2' } };

      const hash1 = hashService.calculateProductHash(data1);
      const hash2 = hashService.calculateProductHash(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('should normalize price tiers for consistent hashing', () => {
      const data1 = {
        a_number: 'A23-100',
        price_tiers: [
          { tier: 2, price: 20 },
          { tier: 1, price: 10 }
        ]
      };

      const data2 = {
        a_number: 'A23-100',
        price_tiers: [
          { tier: 1, price: 10 },
          { tier: 2, price: 20 }
        ]
      };

      const hash1 = hashService.calculateProductHash(data1);
      const hash2 = hashService.calculateProductHash(data2);

      expect(hash1).toBe(hash2); // Order shouldn't matter after normalization
    });
  });

  describe('compareHashes', () => {
    it('should compare hashes case-insensitively', () => {
      expect(hashService.compareHashes('ABC123', 'abc123')).toBe(true);
      expect(hashService.compareHashes('ABC123', 'DEF456')).toBe(false);
    });
  });

  describe('isValidHash', () => {
    it('should validate MD5 hash (32 chars)', () => {
      expect(hashService.isValidHash('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).toBe(true);
    });

    it('should validate SHA-1 hash (40 chars)', () => {
      expect(hashService.isValidHash('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0')).toBe(true);
    });

    it('should reject invalid hashes', () => {
      expect(hashService.isValidHash('too-short')).toBe(false);
      expect(hashService.isValidHash('not-hex-GHIJK123')).toBe(false);
      expect(hashService.isValidHash(null)).toBe(false);
    });
  });
});
```

### Layer 2: Integration Tests (With Strapi Mocked)

**What:** Services that interact with Strapi database/entityService
**Mocking:** Mock `strapi.db.query()` and `strapi.entityService`
**Speed:** Fast (< 500ms per test)

#### Sync Services (`tests/integration/sync/`)

**product-sync-service.test.ts**
```typescript
import productSyncService from '@services/promidata/sync/product-sync-service';

// Mock Strapi
global.strapi = {
  db: {
    query: jest.fn(() => ({
      findOne: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    }))
  },
  entityService: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn()
  }
} as any;

describe('ProductSyncService (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('batchHashCheck', () => {
    it('should perform single query for multiple products', async () => {
      const aNumbers = ['A23-100', 'A23-101', 'A23-102'];
      const supplierId = 1;

      const mockExistingProducts = [
        { id: 1, a_number: 'A23-100', promidata_hash: 'HASH1' },
        { id: 2, a_number: 'A23-101', promidata_hash: 'HASH2' }
      ];

      (strapi.db.query as jest.Mock).mockReturnValue({
        findMany: jest.fn().mockResolvedValue(mockExistingProducts)
      });

      const result = await productSyncService.batchHashCheck(aNumbers, supplierId);

      expect(strapi.db.query).toHaveBeenCalledWith('api::product.product');
      expect(result.size).toBe(3);
      expect(result.get('A23-100')?.exists).toBe(true);
      expect(result.get('A23-102')?.exists).toBe(false);
    });
  });

  describe('filterProductsNeedingSync', () => {
    it('should identify products needing sync based on hash', async () => {
      const productFamilies = [
        { aNumber: 'A23-100', hash: 'NEWHASH1' },
        { aNumber: 'A23-101', hash: 'SAMEHASH' },
        { aNumber: 'A23-102', hash: 'NEWHASH2' }
      ];

      const mockHashCheckResults = new Map([
        ['A23-100', { exists: true, currentHash: 'OLDHASH', needsUpdate: false }],
        ['A23-101', { exists: true, currentHash: 'SAMEHASH', needsUpdate: false }],
        ['A23-102', { exists: false, needsUpdate: true }]
      ]);

      jest.spyOn(productSyncService, 'batchHashCheck').mockResolvedValue(mockHashCheckResults);

      const result = await productSyncService.filterProductsNeedingSync(productFamilies, 1);

      expect(result.needsSync).toHaveLength(2); // A23-100 (hash changed) + A23-102 (new)
      expect(result.skipped).toBe(1); // A23-101 (unchanged)
      expect(result.efficiency).toBeCloseTo(33.3, 1);
    });
  });
});
```

### Layer 3: E2E Tests (With Test Strapi Instance)

**What:** Full orchestration flow with real Strapi instance (test database)
**Mocking:** External APIs only (Promidata API)
**Speed:** Slower (1-5s per test)

#### Orchestration (`tests/e2e/orchestration/`)

**sync-flow.test.ts**
```typescript
import request from 'supertest';

describe('Promidata Sync E2E', () => {
  let strapi;

  beforeAll(async () => {
    // Start Strapi test instance
    await setupStrapi();
  });

  afterAll(async () => {
    await teardownStrapi();
  });

  beforeEach(async () => {
    // Clean database between tests
    await resetDatabase();
  });

  describe('POST /api/promidata-sync/start-sync', () => {
    it('should sync single supplier with mocked API', async () => {
      // Mock Promidata API responses
      mockPromidataAPI();

      // Create test supplier
      const supplier = await strapi.entityService.create('api::supplier.supplier', {
        data: { code: 'A23', name: 'Test Supplier', is_active: true }
      });

      // Trigger sync
      const response = await request(strapi.server.httpServer)
        .post('/api/promidata-sync/start-sync')
        .send({ supplierId: supplier.id })
        .expect(200);

      // Verify results
      expect(response.body.success).toBe(true);
      expect(response.body.data.productsProcessed).toBeGreaterThan(0);

      // Verify database state
      const products = await strapi.db.query('api::product.product').findMany({
        where: { supplier: supplier.id }
      });
      expect(products.length).toBeGreaterThan(0);
    });

    it('should handle incremental sync (skip unchanged products)', async () => {
      // First sync
      await performFullSync('A23');

      // Second sync with same hashes
      mockPromidataAPIWithSameHashes();

      const response = await request(strapi.server.httpServer)
        .post('/api/promidata-sync/start-sync')
        .send({ supplierId: 1 })
        .expect(200);

      // Should skip all products
      expect(response.body.data.skipped).toBe(response.body.data.total);
      expect(response.body.data.efficiency).toBe('100%');
    });
  });

  describe('Product → Variant Hierarchy', () => {
    it('should create Product with multiple ProductVariants', async () => {
      mockPromidataProductFamily({
        aNumber: 'A113-W5501',
        variants: [
          { SKU: 'A113-W5501-RED-S', color: 'Red', size: 'S' },
          { SKU: 'A113-W5501-RED-M', color: 'Red', size: 'M' },
          { SKU: 'A113-W5501-BLUE-S', color: 'Blue', size: 'S' }
        ]
      });

      await performSync('A113');

      // Verify Product created
      const product = await strapi.db.query('api::product.product').findOne({
        where: { a_number: 'A113-W5501' }
      });
      expect(product).toBeTruthy();

      // Verify ProductVariants created
      const variants = await strapi.db.query('api::product-variant.product-variant').findMany({
        where: { product: product.id }
      });
      expect(variants).toHaveLength(3);

      // Verify primary flags (one per color)
      const primaryVariants = variants.filter(v => v.is_primary_for_color);
      expect(primaryVariants).toHaveLength(2); // Red and Blue
    });
  });
});
```

## Test Coverage Goals

**Target Coverage:** 80% overall

- **Parsers:** 90% (pure logic, easy to test)
- **Transformers:** 85% (business logic)
- **Hash Service:** 95% (critical for sync correctness)
- **Sync Services:** 75% (database interactions)
- **Orchestration:** 70% (integration complexity)
- **API Client:** 80% (network error handling)

## Running Tests

```bash
# All tests
npm test

# Unit tests only (fast feedback)
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode for TDD
npm run test:watch

# Coverage report
npm run test:coverage
```

## Benefits of Testing Modular Services

✅ **Isolation**: Each service can be tested independently
✅ **Fast Feedback**: Unit tests run in < 1s
✅ **Confidence**: Refactoring won't break functionality
✅ **Documentation**: Tests serve as usage examples
✅ **Regression Prevention**: Catch bugs before production
✅ **CI/CD Ready**: Automated testing in GitHub Actions

## Next Steps

1. **Phase 1**: Set up Jest + Supertest infrastructure
2. **Phase 2**: Write unit tests for parsers and transformers
3. **Phase 3**: Add integration tests for sync services
4. **Phase 4**: Implement E2E tests for orchestration
5. **Phase 5**: Set up GitHub Actions CI pipeline
6. **Phase 6**: Add test coverage reporting

## Test Data Management

Create `tests/fixtures/` directory with:
- `import-txt-samples.ts`: Mock Import.txt responses
- `product-json-samples.ts`: Mock product API responses
- `supplier-data.ts`: Test supplier configurations

This allows consistent, deterministic testing across all test suites.
