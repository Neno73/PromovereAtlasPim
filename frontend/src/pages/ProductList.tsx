import { useState, useEffect, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, ApiResponse, VerificationStatus, FacetDistribution, Supplier, Category } from '../types';
import { apiService } from '../services/api';
import { ProductCard } from '../components/ProductCard';
import { FilterBar } from '../components/FilterBar';
import { ActiveFilters } from '../components/ActiveFilters';
import { LanguageSelector } from '../components/LanguageSelector';
import './ProductList.css';

export const ProductList: FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facets, setFacets] = useState<FacetDistribution>({});
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 12,
    pageCount: 0,
    total: 0
  });
  const [filters, setFilters] = useState<Record<string, any>>({ isActive: 'true' });
  const [sortBy, setSortBy] = useState('updatedAt:desc');

  // Verification status state
  const [verificationStatus, setVerificationStatus] = useState<Record<string, VerificationStatus>>({});
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

  // Mobile filter toggle
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Suppliers and categories for filter display
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Load products using Meilisearch
  const loadProducts = async (page: number = 1, newFilters?: Record<string, any>) => {
    try {
      setLoading(true);
      setError(null);

      const currentFilters = newFilters || filters;

      // Extract search query
      const searchQuery = currentFilters.search || '';

      // Map filters to Meilisearch format
      const meilisearchFilters: any = {};

      if (currentFilters.supplier) {
        meilisearchFilters.supplier_code = currentFilters.supplier;
      }
      if (currentFilters.brand) {
        meilisearchFilters.brand = currentFilters.brand;
      }
      if (currentFilters.category) {
        meilisearchFilters.category = currentFilters.category;
      }
      if (currentFilters.colors && currentFilters.colors.length > 0) {
        meilisearchFilters.colors = currentFilters.colors;
      }
      if (currentFilters.sizes && currentFilters.sizes.length > 0) {
        meilisearchFilters.sizes = currentFilters.sizes;
      }
      if (currentFilters.priceMin !== undefined && currentFilters.priceMin !== '') {
        meilisearchFilters.price_min = parseFloat(currentFilters.priceMin);
      }
      if (currentFilters.priceMax !== undefined && currentFilters.priceMax !== '') {
        meilisearchFilters.price_max = parseFloat(currentFilters.priceMax);
      }
      if (currentFilters.isActive !== undefined) {
        meilisearchFilters.is_active = currentFilters.isActive === 'true' || currentFilters.isActive === true;
      }

      // Convert sort format (e.g., "updatedAt:desc" -> ["updatedAt:desc"])
      const sortArray = sortBy ? [sortBy] : [];

      // Request facets for filter dropdowns
      const facets = ['supplier_code', 'brand', 'category', 'colors', 'sizes'];

      // Try Meilisearch first, fallback to old API if not available
      let response: ApiResponse<Product[]>;
      try {
        response = await apiService.searchProducts({
          query: searchQuery,
          page,
          pageSize: pagination.pageSize,
          sort: sortArray,
          facets,
          filters: meilisearchFilters,
        });
      } catch (searchError) {
        console.warn('Meilisearch not available, falling back to old API:', searchError);
        // Fallback to old API
        response = await apiService.getProducts({
          page,
          pageSize: pagination.pageSize,
          sort: sortBy,
          filters: currentFilters,
        });
      }

      setProducts(response.data);
      if (response.meta.pagination) {
        setPagination(prev => ({
          ...prev,
          page: response.meta.pagination!.page,
          pageCount: response.meta.pagination!.pageCount,
          total: response.meta.pagination!.total,
        }));
      }
      // Store facet distribution for filter counts
      if ((response.meta as any).facets) {
        setFacets((response.meta as any).facets);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch verification status for displayed products
  const fetchVerificationStatus = async (productList: Product[]) => {
    if (!showVerification || productList.length === 0) {
      return;
    }

    try {
      setVerificationLoading(true);

      // Get document IDs from products
      const documentIds = productList
        .map(p => p.documentId || (p as any).id)
        .filter(Boolean) as string[];

      if (documentIds.length === 0) {
        return;
      }

      const response = await apiService.getProductVerificationStatus(documentIds);

      if (response.success) {
        setVerificationStatus(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch verification status:', err);
    } finally {
      setVerificationLoading(false);
    }
  };

  // Load filter options (suppliers, categories)
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [suppliersRes, categoriesRes] = await Promise.all([
          apiService.getSuppliers(),
          apiService.getCategories(),
        ]);
        setSuppliers(suppliersRes.data);
        setCategories(categoriesRes.data);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    loadFilterOptions();
  }, []);

  // Initial load
  useEffect(() => {
    loadProducts(1);
  }, [sortBy]);

  // Helper to get supplier display name with count
  const getSupplierDisplay = (code: string): string => {
    const supplier = suppliers.find(s => s.code === code);
    const count = facets?.supplier_code?.[code];
    if (supplier) {
      return count !== undefined
        ? `${supplier.name} (${code}) - ${count} products`
        : `${supplier.name} (${code})`;
    }
    return code;
  };

  // Helper to get category display name
  const getCategoryDisplay = (code: string): string => {
    const category = categories.find(c => c.code === code);
    if (category) {
      // Get last segment of name (if path-like)
      const name = typeof category.name === 'string'
        ? category.name
        : category.name?.en || category.name?.de || Object.values(category.name)[0] || code;
      const displayName = name.includes('/') ? name.split('/').pop()?.trim() : name;
      const count = facets?.category?.[code];
      return count !== undefined ? `${displayName} (${count})` : displayName || code;
    }
    return code;
  };

  // Fetch verification status when products or showVerification changes
  useEffect(() => {
    if (showVerification && products.length > 0) {
      fetchVerificationStatus(products);
    }
  }, [products, showVerification]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: Record<string, any>) => {
    setFilters(newFilters);
    loadProducts(1, newFilters);
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    loadProducts(newPage);
  };

  // Handle product click
  const handleProductClick = (productDocumentId: string) => {
    navigate(`/products/${productDocumentId}`);
  };

  // Handle sort change
  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
  };

  // Handle removing a single filter
  const handleRemoveFilter = (key: string, value?: string) => {
    const newFilters = { ...filters };

    if (key === 'colors' || key === 'sizes') {
      // For array filters, remove specific value
      const arr = newFilters[key] as string[];
      newFilters[key] = arr.filter(v => v !== value);
      if (newFilters[key].length === 0) {
        delete newFilters[key];
      }
    } else {
      delete newFilters[key];
    }

    // Keep isActive default
    if (!newFilters.isActive) {
      newFilters.isActive = 'true';
    }

    setFilters(newFilters);
    loadProducts(1, newFilters);
  };

  // Handle clearing all filters
  const handleClearAllFilters = () => {
    const clearedFilters = { isActive: 'true' };
    setFilters(clearedFilters);
    loadProducts(1, clearedFilters);
  };

  return (
    <div className="product-list-page">
      <div className="page-header">
        <h1>Products</h1>
        <div className="page-actions">
          <LanguageSelector />
          <button
            className={`verification-toggle ${showVerification ? 'active' : ''}`}
            onClick={() => setShowVerification(!showVerification)}
            title={showVerification ? 'Hide sync status' : 'Show sync status'}
          >
            {showVerification ? 'Hide Status' : 'Show Status'}
          </button>
          <div className="sort-section">
            <label htmlFor="sort">Sort by:</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              disabled={loading}
            >
              <option value="updatedAt:desc">Recently Updated</option>
              <option value="createdAt:desc">Recently Added</option>
              <option value="sku:asc">SKU A-Z</option>
              <option value="sku:desc">SKU Z-A</option>
              <option value="brand:asc">Brand A-Z</option>
              <option value="brand:desc">Brand Z-A</option>
              <option value="price_min:asc">Price Low to High</option>
              <option value="price_min:desc">Price High to Low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="product-list-content">
        {/* Mobile filter toggle */}
        <button
          className="mobile-filter-toggle"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
        >
          <span className="filter-icon">☰</span>
          {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
        </button>

        <div className={`sidebar ${showMobileFilters ? 'expanded' : 'collapsed'}`}>
          <FilterBar
            onFiltersChange={handleFiltersChange}
            loading={loading}
            facets={facets}
          />
        </div>

        <div className="main-content">
          {error && (
            <div className="error-message">
              <p>Error: {error}</p>
              <button onClick={() => loadProducts(pagination.page)}>
                Try Again
              </button>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <p>Loading products...</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Active filter pills */}
              <ActiveFilters
                filters={filters}
                onRemoveFilter={handleRemoveFilter}
                onClearAll={handleClearAllFilters}
                supplierDisplay={filters.supplier ? getSupplierDisplay(filters.supplier) : undefined}
                categoryDisplay={filters.category ? getCategoryDisplay(filters.category) : undefined}
              />

              <div className="results-summary">
                <p>
                  Showing {products.length} of {pagination.total} products
                  {pagination.pageCount > 1 && ` (Page ${pagination.page} of ${pagination.pageCount})`}
                </p>
              </div>

              {products.length > 0 ? (
                <>
                  <div className="products-grid">
                    {products.map((product) => {
                      // Meilisearch returns 'id', Strapi API returns 'documentId'
                      const productId = product.documentId || (product as any).id;
                      return (
                        <ProductCard
                          key={productId}
                          product={product}
                          onClick={() => handleProductClick(productId)}
                          verificationStatus={showVerification ? verificationStatus[productId] : undefined}
                          verificationLoading={showVerification && verificationLoading}
                        />
                      );
                    })}
                  </div>

                  {pagination.pageCount > 1 && (
                    <div className="pagination">
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1 || loading}
                        className="pagination-btn"
                      >
                        Previous
                      </button>

                      <div className="pagination-info">
                        <span>
                          Page {pagination.page} of {pagination.pageCount}
                        </span>
                      </div>

                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.pageCount || loading}
                        className="pagination-btn"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-products">
                  <h3>No products found</h3>
                  <p>Try adjusting your filters or search terms.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
